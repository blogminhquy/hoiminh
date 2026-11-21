// Logic thuần của chứng chỉ và màn chúc mừng: nhận biết khóa vừa hoàn thành, địa chỉ chứng nhận, định dạng ngày và mã,
// co cỡ chữ và ngắt dòng theo độ dài tên. Không đụng DOM để test được trên Node.

/** Tham số trên địa chỉ trang chứng nhận báo "vừa học xong, hãy chúc mừng". Trang đọc xong thì gỡ ngay khỏi địa chỉ. */
export const CELEBRATE_PARAM = 'chuc-mung';

/** Địa chỉ trang chứng nhận công khai; `celebrate` thêm tham số chúc mừng cho đúng lần vừa học xong. */
export function certificatePath(courseId: string, userId: string, celebrate = false): string {
  return `/chung-nhan/${courseId}/${userId}${celebrate ? `?${CELEBRATE_PARAM}=1` : ''}`;
}

/** Địa chỉ đang mở có mang tham số chúc mừng không. */
export function wantsCelebration(search: string): boolean {
  return new URLSearchParams(search).has(CELEBRATE_PARAM);
}

/** Phản hồi của POST /v1/lessons/:id/complete. Hai cờ cuối có từ bản máy chủ biết chúc mừng; bản cũ hơn không gửi. */
export interface CompleteResult {
  percent: number;
  nextLessonId: string | null;
  courseCompleted?: boolean;
  certificateEnabled?: boolean;
}

export type AfterComplete =
  | { kind: 'certificate'; to: string }
  | { kind: 'congrats' }
  | { kind: 'next'; lessonId: string }
  | { kind: 'stay' };

/**
 * Bấm hoàn thành một bài xong thì đi đâu.
 * - Khóa vừa chuyển từ chưa xong sang xong: tới trang chứng nhận ở chế độ chúc mừng (khóa có cấp chứng nhận),
 *   hoặc mở bảng chúc mừng tại chỗ (khóa không cấp). Việc này thắng cả "sang bài tiếp theo", vì người học có thể
 *   học sai thứ tự và bài làm khóa xong không phải bài cuối giáo trình.
 * - Còn lại: sang bài kế trong chương nếu có, không thì ở yên.
 * Máy chủ báo `courseCompleted` đúng một lần; nếu máy chủ là bản cũ chưa có cờ thì so tiến độ trước và sau.
 */
export function afterComplete(r: CompleteResult, ctx: { percentBefore: number | null | undefined; courseId: string; userId: string | null | undefined; certificateEnabled?: boolean }): AfterComplete {
  const justCompleted = r.courseCompleted ?? (r.percent >= 100 && (ctx.percentBefore ?? 0) < 100);
  if (justCompleted) {
    const certificate = r.certificateEnabled ?? ctx.certificateEnabled ?? false;
    return certificate && ctx.userId ? { kind: 'certificate', to: certificatePath(ctx.courseId, ctx.userId, true) } : { kind: 'congrats' };
  }
  return r.nextLessonId ? { kind: 'next', lessonId: r.nextLessonId } : { kind: 'stay' };
}

/** Múi giờ in trên chứng chỉ: cố định giờ Việt Nam để ai mở link cũng thấy cùng một ngày. */
export const CERTIFICATE_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/** "22 tháng 11, 2026". Trả chuỗi rỗng khi ngày hỏng. */
export function fmtCertificateDate(input: string | Date | null | undefined, timeZone: string = CERTIFICATE_TIME_ZONE): string {
  if (!input) return '';
  const v = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(v.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone }).formatToParts(v);
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return `${pick('day')} tháng ${pick('month')}, ${pick('year')}`;
}

/** Mã kiểm tra tách nhóm bốn ký tự cho dễ đọc và dễ đọc lại qua điện thoại: "4A35 0744 6405". */
export function formatCertificateCode(code: string): string {
  const clean = code.replace(/\s+/g, '').toUpperCase();
  return clean.match(/.{1,4}/g)?.join(' ') ?? '';
}

/** Bỏ giao thức và dấu gạch cuối để địa chỉ kiểm tra gọn hơn khi in: "hoiminh.com/chung-nhan/...". */
export function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}

/** Tên tệp ảnh tải về: không dấu, không ký tự lạ, vẫn nhận ra của ai. "chung-chi-nguyen-van-a.png". */
export function certificateFileName(learnerName: string, ext = 'png'): string {
  const slug = learnerName.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return `chung-chi${slug ? `-${slug}` : ''}.${ext}`;
}

/** "11 bài học · 3 giờ 20 phút": dòng mô tả dưới tên khóa; không có thời lượng thì chỉ còn số bài. */
export function courseSummary(lessonCount: number, totalDurationSeconds: number | null | undefined): string {
  const parts = [`${lessonCount} bài học`];
  const secs = totalDurationSeconds ?? 0;
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  if (h > 0) parts.push(m > 0 ? `${h} giờ ${m} phút` : `${h} giờ`);
  else if (m > 0) parts.push(`${m} phút`);
  return parts.join(' · ');
}

/** Kiểu chữ dùng để đo bề ngang. `tracking` là giãn chữ tính theo em. */
export interface TextStyle { size: number; weight: number; italic?: boolean; tracking?: number }
/** Hàm đo bề ngang một dòng chữ (canvas ở trình duyệt, hàm giả trong test). */
export type Measure = (text: string, style: TextStyle) => number;

export interface FitOptions {
  /** Bề ngang tối đa của mỗi dòng. */
  maxWidth: number;
  /** Cỡ chữ mong muốn khi chữ ngắn. */
  maxSize: number;
  /** Cỡ nhỏ nhất còn đọc được; chạm mức này mà vẫn tràn thì cắt bớt và thêm dấu ba chấm. */
  minSize: number;
  maxLines: number;
  weight: number;
  italic?: boolean;
  tracking?: number;
  /** Chữ xuống nhiều dòng thì cỡ không vượt quá tỉ lệ này của maxSize, để khối chữ không cao quá. Mặc định 0,78. */
  multiLineScale?: number;
  /** Một dòng mà cỡ chữ còn từ tỉ lệ này của maxSize trở lên thì giữ một dòng, không ngắt. Mặc định 0,7. */
  keepSingleAbove?: number;
}

export interface FittedText { size: number; lines: string[]; truncated: boolean }

const REF = 100;

/** Chia các từ thành đúng `n` dòng sao cho dòng dài nhất ngắn nhất có thể (dòng cân nhau, không lẻ một từ). */
function balancedLines(words: string[], n: number, width: (line: string) => number): string[] {
  if (n <= 1 || words.length <= 1) return [words.join(' ')];
  const lines = Math.min(n, words.length);
  // best[k][i]: bề ngang dòng dài nhất khi xếp i từ đầu vào k dòng.
  const best: number[][] = Array.from({ length: lines + 1 }, () => Array<number>(words.length + 1).fill(Infinity));
  const cut: number[][] = Array.from({ length: lines + 1 }, () => Array<number>(words.length + 1).fill(0));
  best[0]![0] = 0;
  for (let k = 1; k <= lines; k++) {
    for (let i = k; i <= words.length; i++) {
      for (let j = k - 1; j < i; j++) {
        const w = Math.max(best[k - 1]![j]!, width(words.slice(j, i).join(' ')));
        if (w < best[k]![i]!) { best[k]![i] = w; cut[k]![i] = j; }
      }
    }
  }
  const out: string[] = [];
  for (let k = lines, i = words.length; k >= 1; k--) {
    const j = cut[k]![i]!;
    out.unshift(words.slice(j, i).join(' '));
    i = j;
  }
  return out;
}

/** Cắt bớt cuối dòng và thêm "…" cho tới khi vừa bề ngang. */
function ellipsize(line: string, fits: (s: string) => boolean): string {
  if (fits(line)) return line;
  let s = line;
  while (s.length > 1 && !fits(`${s.trimEnd()}…`)) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

/**
 * Chọn cỡ chữ và cách ngắt dòng cho một tên (học viên, khóa học, hội) để không bao giờ tràn `maxWidth`:
 * tên ngắn giữ cỡ lớn trên một dòng; tên dài thì co cỡ, co quá nhiều thì ngắt thành các dòng cân nhau;
 * chạm cỡ nhỏ nhất mà vẫn tràn thì cắt bớt kèm dấu ba chấm.
 */
export function fitText(raw: string, o: FitOptions, measure: Measure): FittedText {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text) return { size: o.maxSize, lines: [''], truncated: false };
  const style = (size: number): TextStyle => ({ size, weight: o.weight, italic: o.italic, tracking: o.tracking });
  const refWidth = (line: string) => measure(line, style(REF));
  const sizeFor = (lines: string[], cap: number) => Math.min(cap, Math.floor((o.maxWidth / Math.max(1, Math.max(...lines.map(refWidth)))) * REF));
  const words = text.split(' ');

  const single = sizeFor([text], o.maxSize);
  if (o.maxLines <= 1 || words.length === 1 || single >= o.maxSize * (o.keepSingleAbove ?? 0.7)) {
    if (single >= o.minSize) return { size: single, lines: [text], truncated: false };
    if (o.maxLines <= 1 || words.length === 1) {
      const fits = (s: string) => measure(s, style(o.minSize)) <= o.maxWidth;
      return { size: o.minSize, lines: [ellipsize(text, fits)], truncated: true };
    }
  }

  const multiCap = Math.round(o.maxSize * (o.multiLineScale ?? 0.78));
  let best: FittedText = { size: single, lines: [text], truncated: false };
  for (let n = 2; n <= Math.min(o.maxLines, words.length); n++) {
    const lines = balancedLines(words, n, refWidth);
    const size = sizeFor(lines, multiCap);
    if (size > best.size) best = { size, lines, truncated: false };
    if (size >= multiCap) break;
  }
  if (best.size >= o.minSize) return best;

  // Vẫn tràn ở cỡ nhỏ nhất: xếp tham lam ở cỡ nhỏ nhất, dòng cuối cắt bớt.
  const fits = (s: string) => measure(s, style(o.minSize)) <= o.maxWidth;
  const lines: string[] = [];
  let rest = words;
  while (rest.length && lines.length < o.maxLines) {
    const last = lines.length === o.maxLines - 1;
    if (last) { lines.push(ellipsize(rest.join(' '), fits)); rest = []; break; }
    let take = 1;
    while (take < rest.length && fits(rest.slice(0, take + 1).join(' '))) take++;
    lines.push(ellipsize(rest.slice(0, take).join(' '), fits));
    rest = rest.slice(take);
  }
  return { size: o.minSize, lines, truncated: true };
}
