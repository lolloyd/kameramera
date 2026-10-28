export interface Sticker {
  id: string;
  emoji: string;
  /** Center position as a fraction of the final image. */
  x: number;
  y: number;
  /** Font size as a fraction of the final image width. */
  size: number;
}

export const STICKER_EMOJIS = ['😎', '😂', '🥳', '❤️', '⭐', '🔥', '⚡', '🎉', '👑', '🕶️', '🌈', '💥'];

export const EMOJI_FONT = "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
