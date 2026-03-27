export function assessPlacement({
  selectedBuilding,
  selectedUnitType,
  isOccupied,
  isOwned,
  tileName,
  tileLevel,
}) {
  const selection = selectedBuilding || selectedUnitType
  if (!selection) {
    return { isValid: false, reason: 'Select a building or unit first.' }
  }
  if (isOccupied) {
    return { isValid: false, reason: 'Tile is occupied.' }
  }

  const isGrass = tileName === 'GRASS'
  const isFlatGrass = isGrass && tileLevel === 0
  const isAnyGrass = isGrass

  if (selectedUnitType) {
    if (!isAnyGrass) return { isValid: false, reason: 'Units can only deploy on grass.' }
    return { isValid: true, reason: '' }
  }

  if (!isOwned) return { isValid: false, reason: 'Expand borders to build here.' }

  if (selectedBuilding === 'lumberjack' || selectedBuilding === 'farm' || selectedBuilding === 'market' || selectedBuilding === 'library') {
    return isFlatGrass
      ? { isValid: true, reason: '' }
      : { isValid: false, reason: `${selectedBuilding} requires flat grass.` }
  }
  if (selectedBuilding === 'mine') {
    return isAnyGrass
      ? { isValid: true, reason: '' }
      : { isValid: false, reason: 'Mine requires grass.' }
  }
  if (selectedBuilding === 'tower') {
    return isAnyGrass
      ? { isValid: true, reason: '' }
      : { isValid: false, reason: 'Tower requires grass.' }
  }

  return { isValid: false, reason: 'Invalid placement.' }
}
