/**
 * 감정 7종 설정
 * -----------------------------------------------------------------------------
 * 감정의 이름 · 캐릭터 · 컬러 · 하늘 · 조명 · 파티클을 한 곳에서 관리합니다.
 * color 값을 바꾸면 캐릭터 머리색, 파티클, 강조 UI가 함께 바뀝니다.
 * (플레이 중에는 정보 창에서 감정별 컬러를 직접 바꿀 수도 있고, 그 값은
 *  localStorage 에 저장됩니다.)
 */

export const EMOTIONS = [
  {
    id: 'joy',
    ko: '기쁨',
    en: 'Joy',
    character: 'Clumi',
    color: '#F7C948',
    deep: '#E39A22',
    skyTop: '#FFF3CF',
    skyBottom: '#A6DBF3',
    fog: '#E6F4FB',
    light: '#FFF3D2',
    lightIntensity: 2.35,
    ambient: '#FFE9C9',
    grass: '#BFE59C',
    particleColor: '#FFD782',
    particle: 'motes',
    mood: '따뜻한 햇살이 섬 위로 내려앉아요',
  },
  {
    id: 'sad',
    ko: '슬픔',
    en: 'Sad',
    character: 'Droppy',
    color: '#4C9CD1',
    deep: '#2F6E9B',
    skyTop: '#AFC7DB',
    skyBottom: '#6E93B8',
    fog: '#C9DCEA',
    light: '#D9E9F5',
    lightIntensity: 1.35,
    ambient: '#B9CFE0',
    grass: '#A9CBA6',
    particleColor: '#BFE0F5',
    particle: 'rain',
    mood: '조용한 빗방울이 하나둘 떨어져요',
  },
  {
    id: 'anger',
    ko: '분노',
    en: 'Anger',
    character: 'Flamy',
    color: '#EF7333',
    deep: '#C2491B',
    skyTop: '#FFCFAE',
    skyBottom: '#DC7C50',
    fog: '#F8D6C2',
    light: '#FFD3AE',
    lightIntensity: 2.1,
    ambient: '#F7C09B',
    grass: '#D6C97F',
    particleColor: '#FF9E5E',
    particle: 'embers',
    mood: '뜨거운 열기가 훅 올라와요',
  },
  {
    id: 'fear',
    ko: '두려움',
    en: 'Fear',
    character: 'Windy',
    color: '#A6AAAD',
    deep: '#767C80',
    skyTop: '#DDE4E7',
    skyBottom: '#A5B3BA',
    fog: '#D4DDE1',
    light: '#E4ECEF',
    lightIntensity: 1.5,
    ambient: '#C4D0D5',
    grass: '#AFC7AE',
    particleColor: '#E3EBEE',
    particle: 'wind',
    mood: '서늘한 바람이 맴돌아요',
  },
  {
    id: 'new',
    ko: '새로움',
    en: 'New',
    character: 'Stella',
    color: '#8B4FC0',
    deep: '#68349A',
    skyTop: '#E6D8F7',
    skyBottom: '#7E5BB5',
    fog: '#DCCDF0',
    light: '#E8DCFF',
    lightIntensity: 1.6,
    ambient: '#CDBBEA',
    grass: '#A9C79F',
    particleColor: '#F4E3A8',
    particle: 'stars',
    mood: '낯선 별빛이 반짝이기 시작해요',
  },
  {
    id: 'tired',
    ko: '피로',
    en: 'Tired',
    character: 'Mist',
    color: '#A9C9DC',
    deep: '#7FA7BE',
    skyTop: '#EFF5F8',
    skyBottom: '#C0D4DE',
    fog: '#DCE9EF',
    light: '#F2F8FB',
    lightIntensity: 1.25,
    ambient: '#CCDCE4',
    grass: '#B2CBBE',
    particleColor: '#EAF4F9',
    particle: 'mist',
    mood: '부드러운 안개가 스르르 번져요',
  },
  {
    id: 'hope',
    ko: '희망',
    en: 'Hope',
    character: 'Rooty',
    color: '#B4D33F',
    deep: '#7E9A1E',
    skyTop: '#F0F9D8',
    skyBottom: '#9FD2E8',
    fog: '#E4F3E2',
    light: '#F6FFD9',
    lightIntensity: 2.3,
    ambient: '#DFEFC0',
    grass: '#A9D9B6',
    particleColor: '#D8EE86',
    particle: 'sprouts',
    mood: '새싹 같은 빛가루가 떠올라요',
  },
];

export const EMOTION_BY_ID = Object.fromEntries(EMOTIONS.map((e) => [e.id, e]));

export const DEFAULT_EMOTION = 'joy';

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function shade(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const f = (v) =>
    Math.max(0, Math.min(255, Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount))));
  const to = (v) => f(v).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}
