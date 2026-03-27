import { HexUtils } from './HexUtils.js'
import { getAttackDamage, getDefenseReduction } from '../gameplay/map-rules/biomeModifiers.js'
import { Sounds } from '../core/audio/Sounds.js'
import { log } from '../core/logging/gameConsole.js'
import { EventBus } from '../core/events/EventBus.js'
import { COMBAT, PLAYER_RANGED_UNIT_TYPES, PLAYER_UNIT_TYPES } from './constants.js'

export class CombatSystem {
  constructor(session, app) {
    this.session = session
    this.app = app
  }

  async attack(attackerKey, targetKey) {
    const preview = this.previewAttack(attackerKey, targetKey)
    if (!preview.canAttack) {
      log(`[COMBAT] ${preview.reason}`, 'color: orange')
      Sounds.play('incorrect', 1.0, 0.2, 0.8)
      return
    }

    const attacker = preview.attacker
    const target = preview.target
    this._spendAttackAction(attacker)
    log(`[COMBAT] ${attacker.owner} ${attacker.type} attacks ${target.owner} ${target.type}!`, 'color: red')

    const importantAttack = attacker.type === 'goblin_warlord' || target.type === 'goblin_warlord' || target.type === 'tower' || preview.lethal
    if (importantAttack) {
      if (attacker.type === 'goblin_warlord') {
        EventBus.emit('notification', { text: 'WARLORD STRIKES', duration: 1000 })
      } else if (target.type === 'tower' && attacker.owner === 'enemy') {
        EventBus.emit('notification', { text: 'Tower under attack', duration: 900 })
      }
      EventBus.emit('cameraPan', { target: targetKey })
      EventBus.emit('screenShake', { intensity: 0.55, duration: 220 })
    } else {
      EventBus.emit('screenShake', { intensity: 0.3, duration: 150 })
    }
    await this._fireProjectile(attackerKey, targetKey, attacker)

    const damage = preview.damage
    target.hp -= damage

    this._showDamageEffect(attacker, targetKey, target, damage)
    Sounds.duckMusic?.(0.55, 220)

    if (target.hp <= 0) {
      EventBus.emit('screenShake', { intensity: 0.6, duration: 250 })
      await this._handleKill(attacker, targetKey, target)
    } else if (attacker.xp !== undefined) {
      attacker.xp += COMBAT.XP_ON_ATTACK
      this.session.checkLevelUp(attackerKey, attacker)
    }

    if (this.session.onUpdateUI) this.session.onUpdateUI()
  }

  _canAttack(attacker) {
    if (attacker.owner !== 'player') return true
    const remaining = attacker.mpRemaining ?? attacker.mp ?? 0
    return remaining > 0
  }

  previewAttack(attackerKey, targetKey) {
    const attacker = this.session.objects.get(attackerKey)
    const target = this.session.objects.get(targetKey)

    if (!attacker || !target) {
      return { canAttack: false, reason: 'Missing attacker or target.', attacker, target, damage: 0 }
    }

    if (attacker.owner === target.owner) {
      return { canAttack: false, reason: 'Cannot attack allied units.', attacker, target, damage: 0 }
    }

    if (!this._canAttack(attacker)) {
      return { canAttack: false, reason: 'No actions remaining for attack.', attacker, target, damage: 0 }
    }

    const range = Math.max(1, attacker.range || 1)
    const distance = HexUtils.distance(attackerKey, targetKey)
    if (distance > range) {
      return {
        canAttack: false,
        reason: `Target out of range (${distance}/${range}).`,
        attacker,
        target,
        damage: 0,
        distance,
        range,
      }
    }

    const attackDamage = getAttackDamage(this.session, this.app, attackerKey, attacker, targetKey, target)
    const defense = getDefenseReduction(this.session, this.app, targetKey, target)
    const damage = Math.max(1, attackDamage - defense)
    const remainingHp = Math.max(0, (target.hp ?? 0) - damage)

    return {
      canAttack: true,
      reason: '',
      attacker,
      target,
      damage,
      distance,
      range,
      defense,
      lethal: damage >= (target.hp ?? Infinity),
      remainingHp,
    }
  }

  _spendAttackAction(attacker) {
    if (attacker.owner === 'player') {
      attacker.mpRemaining = 0
      attacker.movedThisTurn = true
    }
  }

  async _fireProjectile(attackerKey, targetKey, attacker) {
    if (!this.app.unitManager) return
    const isRanged =
      PLAYER_RANGED_UNIT_TYPES.includes(attacker.type) ||
      attacker.type === 'tower' ||
      attacker.type === 'goblin_slinger'
    if (!isRanged) return
    const projType = attacker.type === 'tower' ? 'bolt' : 'arrow'
    await this.app.unitManager.fireProjectile(attackerKey, targetKey, projType)
  }

  _showDamageEffect(attacker, targetKey, target, damage) {
    if (!this.app.unitManager) return
    this.app.unitManager.animateHit(targetKey)
    Sounds.play('pop', 1.0, 0.3, 0.6)
    EventBus.emit('combatHit', {
      targetKey,
      damage,
      targetType: target?.type,
      targetOwner: target?.owner,
      attackerType: attacker?.type,
      remainingHp: Math.max(0, target?.hp ?? 0),
      lethal: (target?.hp ?? 0) <= 0,
    })
    const pos = this.app.unitManager.getWorldPosition(HexUtils.parse(targetKey), target.level || 0)
    this.app.spawnFloatingText(`-${damage} HP`, pos, 'var(--hx-danger)')
  }

  async _handleKill(attacker, targetKey, target) {
    log(`[COMBAT] ${target.owner} ${target.type} was destroyed!`, 'color: darkred')
    
    EventBus.emit('combatKill', {
      killer: attacker.owner,
      killed: target.owner,
      killerType: attacker.type,
      killedType: target.type
    })
    
    if (attacker.xp !== undefined) {
      attacker.xp += COMBAT.XP_ON_KILL
      this.session.checkLevelUp(attacker.cKey ?? targetKey, attacker)
    }

    if (target.owner === 'enemy') {
      this.session.recordEnemyKill?.(target.type)
      this.session.removeUnit(targetKey)
      const bounty = this._calculateBounty(target)
      this.session.resources.gold += bounty
      this._showBountyEffect(targetKey, bounty)
      EventBus.emit('combatBounty', { amount: bounty })
    } else {
      if (PLAYER_UNIT_TYPES.includes(target.type)) {
        this.session.removeUnit(targetKey)
      } else {
        this.session.removeObject(targetKey)
      }
    }
  }

  _calculateBounty(target) {
    return COMBAT.BOUNTY_BY_TYPE?.[target?.type] ?? 20
  }

  _showBountyEffect(targetKey, bounty) {
    if (!this.app.unitManager) return
    const kp = HexUtils.parse(targetKey)
    this.app.spawnFloatingText(`+${bounty} 🪙`, this.app.unitManager.getWorldPosition(kp, 0), '#ffd700')
  }
}
