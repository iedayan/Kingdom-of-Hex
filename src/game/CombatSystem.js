import { HexUtils } from './HexUtils.js'
import { getAttackDamage } from '../gameplay/map-rules/biomeModifiers.js'
import { Sounds } from '../core/audio/Sounds.js'
import { log } from '../core/logging/gameConsole.js'
import { EventBus } from '../core/events/EventBus.js'
import { COMBAT } from './constants.js'

export class CombatSystem {
  constructor(session, app) {
    this.session = session
    this.app = app
  }

  async attack(attackerKey, targetKey) {
    const attacker = this.session.objects.get(attackerKey)
    const target = this.session.objects.get(targetKey)
    if (!attacker || !target) return

    if (!this._canAttack(attacker)) {
      log('[COMBAT] No actions remaining for attack.', 'color: orange')
      Sounds.play('incorrect', 1.0, 0.2, 0.8)
      return
    }

    this._spendAttackAction(attacker)
    log(`[COMBAT] ${attacker.owner} ${attacker.type} attacks ${target.owner} ${target.type}!`, 'color: red')

    EventBus.emit('screenShake', { intensity: 0.3, duration: 150 })
    await this._fireProjectile(attackerKey, targetKey, attacker)

    const damage = getAttackDamage(this.session, this.app, attackerKey, attacker, targetKey, target)
    target.hp -= damage

    this._showDamageEffect(targetKey, target, damage)
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

  _spendAttackAction(attacker) {
    if (attacker.owner === 'player') {
      attacker.mpRemaining = 0
      attacker.movedThisTurn = true
    }
  }

  async _fireProjectile(attackerKey, targetKey, attacker) {
    if (!this.app.unitManager) return
    const isRanged = attacker.type === 'archer' || attacker.type === 'tower' || attacker.type === 'goblin_slinger'
    if (!isRanged) return
    const projType = attacker.type === 'tower' ? 'bolt' : 'arrow'
    await this.app.unitManager.fireProjectile(attackerKey, targetKey, projType)
  }

  _showDamageEffect(targetKey, target, damage) {
    if (!this.app.unitManager) return
    this.app.unitManager.animateHit(targetKey)
    Sounds.play('pop', 1.0, 0.3, 0.6)
    EventBus.emit('combatHit', { targetKey, damage, targetType: target?.type, targetOwner: target?.owner })
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
      if (['scout', 'archer', 'knight'].includes(target.type)) {
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
