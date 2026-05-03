export const T = {
  cream:      '#FBF7F2',
  creamDeep:  '#F5EFE6',
  paper:      '#FFFFFF',
  ink:        '#3D3430',
  inkSoft:    '#6B5D56',
  inkMute:    '#9A8B84',
  line:       '#EDE4D8',
  lineSoft:   '#F1EBE0',
  rose:       '#FADADD',
  mauve:      '#D9A7B0',
  mauveDeep:  '#B07681',
  lavender:   '#E6E0F8',
  mint:       '#D4F1E8',
  butter:     '#FDF4D2',
  powder:     '#DDEAF6',
  peach:      '#FFE5D9',
  errorBg:    '#F7DADB',
  errorTx:    '#9B5D5D',
  successTx:  '#5D8C74',
};

// 30 renk her seviyede — k-means'in fotoğrafın nüanslarını gerçekten
// yakalaması için. Difficulty arasındaki fark sadece grid boyutu (detay
// seviyesi) ve render stili (easy düz pixel, medium pixel+grid, hard
// sembollü kanaviçe charı).
export const DIFFICULTIES = [
  { id: 'easy',   label: 'Kolay', desc: 'Hızlı, fotoğrafa sadık',                      tint: '#D4F1E8', gridSize: 45, numColors: 30 },
  { id: 'medium', label: 'Orta',  desc: 'Dengeli — daha çok detay',                    tint: '#E6E0F8', gridSize: 60, numColors: 30 },
  { id: 'hard',   label: 'Zor',   desc: 'Maksimum detay, sembollü canlı chart',        tint: '#FADADD', gridSize: 70, numColors: 30 },
];
