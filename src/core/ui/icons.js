import { createIcons } from 'lucide'
import {
  Axe,
  BookOpen,
  Castle,
  Coins,
  Compass,
  FlaskConical,
  Lock,
  Mountain,
  Pickaxe,
  Shield,
  ShoppingCart,
  Target,
  TreePine,
  Wheat,
} from 'lucide'

/** Only icons referenced via `data-lucide` in the app — keeps the bundle small. */
const icons = {
  axe: Axe,
  castle: Castle,
  coins: Coins,
  compass: Compass,
  'flask-conical': FlaskConical,
  'book-open': BookOpen,
  lock: Lock,
  mountain: Mountain,
  pickaxe: Pickaxe,
  shield: Shield,
  'shopping-cart': ShoppingCart,
  target: Target,
  'tree-pine': TreePine,
  wheat: Wheat,
}

/**
 * Replace `[data-lucide]` placeholders under `root` with Lucide SVGs.
 * @param {ParentNode} [root]
 */
export function refreshLucideIcons(root = document.body) {
  if (typeof document === 'undefined') return
  createIcons({ icons, nameAttr: 'data-lucide', root })
}
