// Mã giới thiệu chung của một người (chủ dự án yêu cầu ngày 21/11/2026): mỗi người tự chọn MỘT mã, dùng cho link của
// mọi chương trình mình làm affiliate (nền tảng và từng hội), không trùng với mã của bất kỳ ai, và chỉ đặt được một lần.
//
// Cách ghép vào Affiliate Engine mà không đổi luật hoa hồng:
//   - Mỗi tài khoản affiliate (một người trong một chương trình) vẫn giữ mã RIÊNG như trước
//     (`affiliate_accounts.affiliate_code`). Mọi phép tính người giới thiệu và hoa hồng vẫn chạy trên mã riêng.
//   - Mã chung chỉ là tên gọi khác. Ở cửa vào của máy chủ, canonicalRefs đổi mã chung thành mã riêng của ĐÚNG MỘT
//     chương trình, theo trang mà link được mở: mở ở trang của một hội thì là tài khoản của người đó trong chương trình
//     hội ấy, mở ở trang khác thì là tài khoản trong chương trình nền tảng. Y như trước đây link của hội chỉ tính cho
//     hội, link nền tảng chỉ tính cho nền tảng.
//   - Mã riêng cũ vẫn chạy mãi, nên link đã chia sẻ trước khi đặt mã chung không hỏng.
import { REFERRAL_CODE_PATTERN, REF_PLATFORM_SCOPE, refCodes, splitRef } from '@hoiminh/contracts';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { affiliateAccounts, affiliatePrograms, affiliateUserCodes, communities, communityMembers, communitySlugAliases, users } from '@hoiminh/db';
import type { Ctx } from '../context';
import { conflict, invalid } from '../errors';
import { requireUser } from '../permissions';
import { platformProgram } from './affiliate-links';
import { audit } from './audit';

type Program = typeof affiliatePrograms.$inferSelect;

/** Mã không ai được chọn: dễ bị hiểu là mã của chính Hội Mình hoặc của người quản trị. */
const RESERVED = new Set(['admin', 'administrator', 'hoiminh', 'hoiminhcom', 'support', 'hotro', 'system', 'hethong', 'quantri', 'official', 'chinhthuc', 'staff', 'mod', 'moderator', 'root', 'api', 'www', 'ref', 'affiliate', 'null', 'undefined', 'test']);

/** Mã chung một người đã đặt, chưa đặt thì null. */
export async function personalCodeOf(ctx: Ctx, userId: string): Promise<string | null> {
  const row = await ctx.db.query.affiliateUserCodes.findFirst({ where: eq(affiliateUserCodes.userId, userId), columns: { code: true } });
  return row?.code ?? null;
}

/** Mã hiện cho mọi người thấy (trên link, trong ví): mã chung nếu người đó đã đặt, không thì mã riêng của tài khoản. */
export async function displayCode(ctx: Ctx, userId: string, accountCode: string): Promise<string> {
  return (await personalCodeOf(ctx, userId)) ?? accountCode;
}

/** Mã đã có người dùng chưa, xét cả mã riêng của các tài khoản affiliate lẫn mã chung. Dùng khi sinh mã tự động. */
export async function codeTaken(ctx: Ctx, code: string): Promise<boolean> {
  const acc = await ctx.db.query.affiliateAccounts.findFirst({ where: eq(affiliateAccounts.affiliateCode, code), columns: { id: true } });
  if (acc) return true;
  const personal = await ctx.db.query.affiliateUserCodes.findFirst({ where: eq(affiliateUserCodes.code, code), columns: { userId: true } });
  return Boolean(personal);
}

/**
 * Chương trình ứng với trang mà link được mở. Phạm vi là đường dẫn của một hội (kể cả đường dẫn cũ đã đổi) thì là
 * chương trình của hội đó, hội chưa có chương trình thì không tính cho ai. Mọi phạm vi khác (trang chủ, trang mở hội,
 * trang đăng ký trơn) là chương trình nền tảng.
 */
async function programForScope(ctx: Ctx, scope: string): Promise<Program | null> {
  if (scope !== REF_PLATFORM_SCOPE) {
    let community = await ctx.db.query.communities.findFirst({ where: eq(communities.slug, scope), columns: { id: true } });
    if (!community) {
      const alias = await ctx.db.query.communitySlugAliases.findFirst({ where: eq(communitySlugAliases.slug, scope), columns: { communityId: true } });
      if (alias) community = { id: alias.communityId };
    }
    if (community) return (await ctx.db.query.affiliatePrograms.findFirst({ where: eq(affiliatePrograms.communityId, community.id) })) ?? null;
  }
  return platformProgram(ctx);
}

/**
 * Mã riêng của tài khoản mà chủ mã chung có trong một chương trình. Chưa có tài khoản thì mở luôn nếu người đó đủ điều
 * kiện (chương trình đang bật; chương trình của hội thì phải đang là thành viên của hội), giống như lúc họ tự mở trang
 * Affiliate của chương trình đó: tài khoản affiliate vốn tự mở không cần duyệt. Nhờ vậy mã chung dùng được ở mọi nơi
 * người đó được làm affiliate mà không phải vào mở ví từng chương trình trước.
 */
async function accountCodeIn(ctx: Ctx, ownerUserId: string, program: Program): Promise<string | null> {
  const acc = await ctx.db.query.affiliateAccounts.findFirst({ where: and(eq(affiliateAccounts.userId, ownerUserId), eq(affiliateAccounts.programId, program.id)), columns: { affiliateCode: true } });
  if (acc) return acc.affiliateCode;
  if (program.status !== 'active') return null;
  if (program.scopeType === 'community') {
    if (!program.communityId) return null;
    const member = await ctx.db.query.communityMembers.findFirst({ where: and(eq(communityMembers.communityId, program.communityId), eq(communityMembers.userId, ownerUserId), inArray(communityMembers.status, ['active', 'cancelling'])), columns: { id: true } });
    if (!member) return null;
  }
  // Nạp muộn để tránh vòng import: affiliate.ts dùng lại các hàm của tệp này.
  const { ensureAccount } = await import('./affiliate');
  return (await ensureAccount(ctx, ownerUserId, program.id)).affiliateCode;
}

/**
 * Đổi danh sách mã người xem mang theo (`mã` hoặc `mã.phạm-vi`, mới bấm đứng trước) thành MÃ RIÊNG của các tài khoản
 * affiliate, giữ nguyên thứ tự. Mọi nơi tính người giới thiệu gọi hàm này trước rồi mới tra tài khoản.
 *   - Mã riêng của một tài khoản: giữ nguyên, phạm vi không có ý nghĩa (tài khoản đã thuộc sẵn một chương trình).
 *   - Mã chung có phạm vi: thành mã riêng của chủ mã trong chương trình ứng với phạm vi đó (xem programForScope).
 *   - Mã chung không có phạm vi (gõ tay, hoặc gọi API không qua web): nơi gọi biết chương trình (`programId`, ví dụ
 *     thành viên nhập mã ở trang Xếp hạng của một hội) thì lấy chương trình đó, không thì tính cho nền tảng.
 *   - Mã không ai dùng, hoặc chủ mã không làm affiliate được ở chương trình đó: bỏ.
 */
export async function canonicalRefs(ctx: Ctx, ref: string | null | undefined, opts: { programId?: string } = {}): Promise<string[]> {
  const tokens = refCodes(ref).map(splitRef);
  if (!tokens.length) return [];
  const codes = [...new Set(tokens.map((t) => t.code))];
  const known = new Set((await ctx.db.query.affiliateAccounts.findMany({ where: inArray(affiliateAccounts.affiliateCode, codes), columns: { affiliateCode: true } })).map((a) => a.affiliateCode));
  const rest = codes.filter((c) => !known.has(c));
  // Thường gặp nhất: toàn mã riêng. Khi đó không tra thêm gì, đường tính hoa hồng chạy đúng như trước khi có mã chung.
  const owners = rest.length ? await ctx.db.query.affiliateUserCodes.findMany({ where: inArray(affiliateUserCodes.code, rest) }) : [];
  const out: string[] = [];
  for (const t of tokens) {
    let code: string | null = null;
    if (known.has(t.code)) code = t.code;
    else {
      const owner = owners.find((o) => o.code === t.code);
      if (owner) {
        const program = t.scope !== null
          ? await programForScope(ctx, t.scope)
          : opts.programId
            ? ((await ctx.db.query.affiliatePrograms.findFirst({ where: eq(affiliatePrograms.id, opts.programId) })) ?? null)
            : await platformProgram(ctx);
        code = program ? await accountCodeIn(ctx, owner.userId, program) : null;
      }
    }
    if (code && !out.includes(code)) out.push(code);
  }
  return out;
}

/** Mã chung của tôi và còn được đặt hay không (mỗi người chỉ đặt một lần). */
export async function myReferralCode(ctx: Ctx): Promise<{ code: string | null; editable: boolean }> {
  const code = await personalCodeOf(ctx, requireUser(ctx));
  return { code, editable: code === null };
}

/**
 * Đặt mã giới thiệu chung. Chỉ một lần cho mỗi người: đã đặt thì không đổi được nữa, nên giao diện phải hỏi lại trước
 * khi gọi. Mã không được trùng với bất kỳ mã nào trên nền tảng (mã chung của người khác, mã riêng của mọi tài khoản
 * affiliate kể cả của chính mình, vì mã riêng luôn được ưu tiên khi tra), không trùng tên định danh của người khác (kẻo
 * mạo danh), và không nằm trong danh sách giữ cho hệ thống. Đặt không thành thì chưa mất lượt.
 */
export async function setMyReferralCode(ctx: Ctx, input: { code: string }): Promise<{ code: string; editable: false }> {
  const userId = requireUser(ctx);
  const code = input.code.trim().toLowerCase();
  if (!REFERRAL_CODE_PATTERN.test(code)) throw invalid('Mã gồm 3 đến 20 ký tự, chỉ dùng chữ không dấu và số');
  const already = () => conflict('Bạn đã đổi mã giới thiệu rồi. Mỗi người chỉ được đổi một lần.');
  if (await personalCodeOf(ctx, userId)) throw already();
  if (RESERVED.has(code)) throw invalid('Mã này được giữ cho hệ thống. Bạn chọn mã khác nhé.');
  const taken = () => conflict('Mã này đã có người dùng. Bạn chọn mã khác nhé.');
  if (await codeTaken(ctx, code)) throw taken();
  const sameHandle = await ctx.db.query.users.findFirst({ where: and(eq(users.handle, code), ne(users.id, userId)), columns: { id: true } });
  if (sameHandle) throw conflict('Mã này trùng tên định danh của một thành viên khác. Bạn chọn mã khác nhé.');
  // Hai request cùng lúc: khóa chính (mỗi người một dòng) và chỉ mục duy nhất trên mã quyết định ai thắng.
  const rows = await ctx.db.insert(affiliateUserCodes).values({ userId, code }).onConflictDoNothing().returning({ code: affiliateUserCodes.code });
  if (!rows.length) throw (await personalCodeOf(ctx, userId)) ? already() : taken();
  await audit(ctx, { action: 'affiliate.set_referral_code', resourceType: 'user', resourceId: userId, metadata: { code } });
  return { code, editable: false };
}
