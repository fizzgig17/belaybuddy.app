import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

/**
 * Every icon the app uses, by meaning. iOS draws SF Symbols; Android and the
 * website draw Material Symbols, so each icon needs both names.
 */
const icon = (ios: SFSymbol, material: AndroidSymbol) => ({ ios, android: material, web: material });

export const Icons = {
  gym: icon('building.2', 'apartment'),
  crag: icon('mountain.2', 'landscape'),
  favorite: icon('star', 'star'),
  nearby: icon('location', 'location_on'),
  travel: icon('airplane', 'flight'),
  safety: icon('hand.raised', 'back_hand'),
  camera: icon('camera', 'photo_camera'),
  holdMap: icon('hand.point.up.left', 'touch_app'),
  tips: icon('lightbulb', 'lightbulb'),
  settings: icon('gearshape', 'settings'),
  checklist: icon('checkmark.shield', 'verified_user'),
  gear: icon('bag', 'backpack'),
  knot: icon('link', 'link'),
  chevron: icon('chevron.right', 'chevron_right'),
  directions: icon('arrow.triangle.turn.up.right.diamond', 'directions'),
  myLocation: icon('location.fill', 'my_location'),
  search: icon('magnifyingglass', 'search'),
  external: icon('arrow.up.right.square', 'open_in_new'),
  website: icon('globe', 'language'),
  warning: icon('exclamationmark.triangle', 'error'),
  favoriteOn: icon('star.fill', 'star_rate'),
  home: icon('house', 'home'),
  homeOn: icon('house.fill', 'home'),
  board: icon('list.bullet.rectangle', 'view_list'),
  chat: icon('bubble.left.and.bubble.right', 'forum'),
  person: icon('person.crop.circle', 'account_circle'),
  add: icon('plus', 'add'),
  clock: icon('clock', 'schedule'),
  block: icon('nosign', 'block'),
  flag: icon('flag', 'flag'),
  send: icon('arrow.up.circle.fill', 'send'),
  scale: icon('scalemass', 'scale'),
  lock: icon('lock.fill', 'lock'),
  shop: icon('bag', 'storefront'),
  close: icon('xmark', 'close'),
  session: icon('play.circle', 'play_circle'),
} as const;

export type IconName = keyof typeof Icons;
