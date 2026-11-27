// Emoji cho khung chọn ở ô bình luận và ô chat: emoji 2D có sẵn trong máy (không tải ảnh), chia nhóm như Zalo nhưng
// gọn hơn, chỉ giữ những cái hay dùng khi trò chuyện.
export interface EmojiGroup { key: string; label: string; icon: string; items: string[] }

const split = (s: string) => [...new Intl.Segmenter('vi', { granularity: 'grapheme' }).segment(s.replace(/\s+/g, ''))].map((x) => x.segment);

export const EMOJI_GROUPS: EmojiGroup[] = [
  { key: 'mat', label: 'Cảm xúc', icon: '😀', items: split('😀😃😄😁😆😅🤣😂🙂😉😊😇🥰😍🤩😘😗😚😋😛😜🤪😝🤗🤭🤫🤔🫡🤐🤨😐😑😶😏😒🙄😬😮‍💨🤥😌😔😪🤤😴😷🤒🤕🤢🤮🥵🥶🥴😵🤯🤠🥳🥸😎🤓🧐😕🫤😟🙁😮😯😲😳🥺🥹😦😧😨😰😥😢😭😱😖😣😞😓😩😫🥱😤😡😠🤬😈👿💀💩🤡👻😺😸😹😻😼😽🙀😿😾🙈🙉🙊') },
  { key: 'tay', label: 'Cử chỉ', icon: '👍', items: split('👍👎👌🤌✌️🤞🫰🤟🤘🤙👈👉👆👇☝️👋🤚🖐️✋🖖👏🙌🫶👐🤲🤝🙏✍️💪🦾🫵👀🧠') },
  { key: 'tim', label: 'Trái tim', icon: '❤️', items: split('❤️🧡💛💚💙💜🤎🖤🤍🩷🩵💔❤️‍🔥❤️‍🩹💕💞💓💗💖💘💝💟❣️💋💯💢💥💫💦💨🕳️💬💭💤') },
  { key: 'thu', label: 'Con vật', icon: '🐱', items: split('🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🐔🐧🐦🐤🦆🦅🦉🐺🐴🦄🐝🐛🦋🐌🐞🐢🐍🐙🦀🐠🐟🐬🐳🦈🐘🦒🦓🐕🐈🐓🦚🌸🌹🌻🌼🌷🌱🌿🍀🍁🌴🌵') },
  { key: 'an', label: 'Ăn uống', icon: '🍜', items: split('🍎🍊🍋🍌🍉🍇🍓🫐🍒🍑🥭🍍🥥🥑🍅🌶️🌽🥕🥔🍠🥐🍞🥖🧀🥚🍳🥓🍗🍖🌭🍔🍟🍕🥪🌮🥗🍝🍜🍲🍛🍣🍱🥟🍤🍙🍚🍘🍥🥮🍡🍧🍨🍦🥧🧁🍰🎂🍮🍭🍬🍫🍿🍩🍪☕🍵🧋🥤🍺🍻🥂🍷') },
  { key: 'vui', label: 'Hoạt động', icon: '🎉', items: split('🎉🎊🎈🎁🎀🎂🏆🥇🥈🥉🏅🎖️⚽🏀🏐🏸🏓🎾🏊🚴🧘🏃💃🕺🎮🎲🎯🎤🎧🎸🎹🎬🎨📸🎓📚📖✏️📝💡🔥⭐🌟✨⚡☀️🌈☁️🌧️❄️🌙') },
  { key: 'do', label: 'Đồ vật', icon: '💼', items: split('💼💰💵💳💎📈📉📊📌📍📎✂️🔒🔑🛒🎯⏰⌛📅📆📱💻🖥️⌨️🖨️📷📹📞☎️📧📨📩✉️📦🏷️🔔📣📢🚀✈️🚗🛵🚲🏠🏢🏫🏥🗺️🧳⛱️') },
  { key: 'ky', label: 'Ký hiệu', icon: '✅', items: split('✅☑️✔️❌❎➕➖➗✖️❓❔❗❕‼️⁉️⭕🚫⛔🔴🟠🟡🟢🔵🟣⚫⚪🟥🟩🟦⬆️⬇️⬅️➡️↩️🔁🔄🆗🆕🆓🔝🔜💲©️®️™️🇻🇳') },
];

/** Tin nhắn hay bình luận chỉ có 1-3 emoji (không chữ): hiện cỡ lớn, như Zalo. */
export const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*\s*){1,3}$/u;
