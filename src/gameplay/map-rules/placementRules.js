export function assessPlacement({
  selectedBuilding,
  selectedUnitType,
  isOccupied,
  isOwned,
  tileName,
  tileLevel,
  neighborTypes = [],
  turn = 1,
  resources = null,
  distanceToCapital = null,
}) {
  const selection = selectedBuilding || selectedUnitType
  if (!selection) {
    return { isValid: false, reason: 'Select a building or unit first.', hint: '', quality: 'invalid' }
  }
  if (isOccupied) {
    return { isValid: false, reason: 'Tile is occupied.', hint: '', quality: 'invalid' }
  }

  const isGrass = tileName === 'GRASS'
  const isFlatGrass = isGrass && tileLevel === 0
  const isAnyGrass = isGrass
  const counts = neighborTypes.reduce((acc, type) => {
    if (!type) return acc
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {})

  if (selectedUnitType) {
    if (!isAnyGrass) return { isValid: false, reason: 'Units can only deploy on grass.', hint: '', quality: 'invalid' }
    const unitHint = describeUnitPlacement(selectedUnitType, { turn, distanceToCapital })
    return { isValid: true, reason: '', hint: unitHint.hint, quality: unitHint.quality }
  }

  if (!isOwned) return { isValid: false, reason: 'Expand borders to build here.', hint: '', quality: 'invalid' }

  if (selectedBuilding === 'lumberjack' || selectedBuilding === 'farm' || selectedBuilding === 'market' || selectedBuilding === 'library') {
    return isFlatGrass
      ? describeBuildingPlacement(selectedBuilding, { counts, resources, distanceToCapital, turn })
      : { isValid: false, reason: `${selectedBuilding} requires flat grass.`, hint: '', quality: 'invalid' }
  }
  if (selectedBuilding === 'mine') {
    return isAnyGrass
      ? describeBuildingPlacement(selectedBuilding, { counts, resources, distanceToCapital, turn })
      : { isValid: false, reason: 'Mine requires grass.', hint: '', quality: 'invalid' }
  }
  if (selectedBuilding === 'tower') {
    return isAnyGrass
      ? describeBuildingPlacement(selectedBuilding, { counts, resources, distanceToCapital, turn })
      : { isValid: false, reason: 'Tower requires grass.', hint: '', quality: 'invalid' }
  }

  return { isValid: false, reason: 'Invalid placement.', hint: '', quality: 'invalid' }
}

function describeBuildingPlacement(building, { counts, resources, distanceToCapital, turn }) {
  switch (building) {
    case 'farm': {
      const adjacentFarms = counts.farm || 0
      if ((resources?.food ?? 999) < 18) {
        return { isValid: true, reason: '', hint: 'High priority food tile. Your reserves are running low.', quality: 'strong' }
      }
      if (adjacentFarms > 0) {
        return { isValid: true, reason: '', hint: `Strong farm chain: +${adjacentFarms * 3} bonus food from adjacency.`, quality: 'strong' }
      }
      return { isValid: true, reason: '', hint: 'Safe baseline economy. Farms stabilize upkeep and feed markets.', quality: 'good' }
    }
    case 'lumberjack': {
      const adjacent = counts.lumberjack || 0
      if (adjacent > 0) {
        return { isValid: true, reason: '', hint: `Wood cluster online: +${adjacent * 2} wood from adjacent lumber camps.`, quality: 'strong' }
      }
      return { isValid: true, reason: '', hint: 'Reliable early wood. Stronger when chained beside other lumber camps.', quality: 'good' }
    }
    case 'mine': {
      const adjacent = counts.mine || 0
      if (adjacent > 0) {
        return { isValid: true, reason: '', hint: `Mining seam: +${adjacent * 3} stone from adjacent mines.`, quality: 'strong' }
      }
      return { isValid: true, reason: '', hint: 'Good stone income. Pair a second mine nearby to accelerate fortifications.', quality: 'good' }
    }
    case 'market': {
      const supportBuildings = (counts.farm || 0) + (counts.lumberjack || 0) + (counts.mine || 0) + (counts.library || 0) + (counts.tower || 0)
      if ((resources?.food ?? 0) < 10) {
        return { isValid: true, reason: '', hint: 'Legal, but weak right now. Markets need surplus food to convert into gold.', quality: 'risky' }
      }
      if (supportBuildings >= 2) {
        return { isValid: true, reason: '', hint: `Prime trade hub: ${supportBuildings} adjacent buildings will boost gold output.`, quality: 'strong' }
      }
      return { isValid: true, reason: '', hint: 'Works now, but gets better when surrounded by your economy.', quality: 'good' }
    }
    case 'library': {
      if ((resources?.science ?? 0) < 10 && turn <= 8) {
        return { isValid: true, reason: '', hint: 'Excellent timing. Early science snowballs into archers, markets, and towers.', quality: 'strong' }
      }
      return { isValid: true, reason: '', hint: 'Steady research tile. Best when you need a tech spike before tougher raids.', quality: 'good' }
    }
    case 'tower': {
      if (typeof distanceToCapital === 'number' && distanceToCapital >= 2) {
        return { isValid: true, reason: '', hint: 'Forward defense line. This tower can intercept raids before they hit the core.', quality: 'strong' }
      }
      return { isValid: true, reason: '', hint: 'Solid defensive anchor. Towers also reinforce nearby units.', quality: 'good' }
    }
    default:
      return { isValid: true, reason: '', hint: '', quality: 'good' }
  }
}

function describeUnitPlacement(unitType, { turn, distanceToCapital }) {
  switch (unitType) {
    case 'scout':
      if (turn <= 5 && typeof distanceToCapital === 'number' && distanceToCapital >= 2) {
        return { hint: 'Fast opener. A scout here reveals more territory quickly.', quality: 'strong' }
      }
      return { hint: 'Flexible recon unit. Use it to reveal space and pick fights carefully.', quality: 'good' }
    case 'archer':
      return { hint: 'Strong behind towers or support lines. Keep range advantages.', quality: 'good' }
    case 'knight':
      return { hint: 'Frontline deployment. Best used where raids are about to connect.', quality: 'good' }
    default:
      return { hint: '', quality: 'good' }
  }
}
