// Bài viết, ảnh, bình luận, phản ứng, bình chọn cho Bảng tin của hội chính.
import type { Database } from '../client';
import { comments, pollOptions, pollVotes, polls, postImages, posts, reactions } from '../schema';
import type { SeedCommunity } from './community';
import { daysFrom, sid } from './ids';
import type { SeedUser } from './users';

const DIARY_MD = `Sau khi làm lại lead magnet theo bài 2.3, mình chạy **200.000đ tiền ads** trong 3 ngày và có **41 email**, **1 đơn 490.000đ**. Chưa lãi nhưng tự tin hơn nhiều. Dưới đây là toàn bộ số liệu, ảnh chụp dashboard và 3 điều mình rút ra.

![Dashboard quảng cáo sau 3 ngày, chi 200.000đ](seed://img/dashboard)

## Bối cảnh: mình làm gì trước đó

Hai tuần đầu mình chạy thẳng vào trang bán, tốn *gần 600.000đ* mà không có đơn nào. Lý do đơn giản: người lạ chưa tin mình, chưa có lý do để đọc hết trang bán.

> Người ta mua vì tin người giới thiệu, không phải vì giảm giá. Câu này của anh @hoang-vu trong buổi Q&A tuần trước đã đổi cách mình làm.

## Lead magnet mới: một trang, một lời hứa

Mình bỏ hết, làm lại theo đúng công thức ở bài 2.3:

1. **Một lời hứa cụ thể**: “Bộ 12 prompt viết bài bán hàng cho shop nhỏ, dùng ngay trong 10 phút”.
2. **Một ảnh** chụp kết quả thật, không mockup.
3. **Một nút**: nhập email, nhận ngay qua tin nhắn chào tự động của hội.

### Số liệu 3 ngày

- Chi ads: \`200.000đ\` · 1.840 lượt xem · 41 email (*2,2%*)
- Mở tin nhắn chào: 33/41 · bấm link khóa học: 12
- Đơn: 1 × 490.000đ · hoa hồng cộng sự về ví: **245.000đ** (đang giữ 14 ngày)

## Ba điều mình rút ra

**1. Tin nhắn chào quan trọng hơn trang bán.** 33 người mở tin nhắn, chỉ 12 người vào trang bán, nhưng 1 người mua đến từ nhóm đã trả lời tin nhắn.

**2. Đừng giảm giá ở lần chạm đầu.** Mình có gắn mã giảm 10% ở email đầu, không ai dùng.

**3. Ghi lại mọi thứ.** *Bài nhật ký này* chính là nội dung cho tuần sau.

---

Tuần sau mình thử tăng ngân sách lên 500.000đ và đổi ảnh. Ai đã chạy tương tự cho mình xin số liệu để so nhé.`;

const IMAGE_COLORS = ['#7A5C3E', '#0E8E96', '#D4593A', '#3E5C7A', '#5C3E7A', '#C89B3C'];

/** Ảnh mẫu dạng SVG data URL theo màu (không cần R2). */
export function placeholderImage(color: string, w = 1200, h = 800): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${color}"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Bài viết trên Bảng tin khớp demo: ghim, status nền màu, hỏi đáp, nhật ký nhiều ảnh, bình chọn. */
export async function seedContent(db: Database, base: Date, U: Record<string, SeedUser>, c: SeedCommunity): Promise<Record<string, string>> {
  const ids = {
    pinned: await sid('post:kd:pinned'), status: await sid('post:kd:status'), question: await sid('post:kd:question'),
    diary: await sid('post:kd:diary'), leadmagnet: await sid('post:kd:leadmagnet'), poll: await sid('post:kd:poll'), month8: await sid('post:kd:month8'),
  };
  await db
    .insert(posts)
    .values([
      { id: ids.pinned, communityId: c.id, spaceId: c.spaces['thong-bao']!, authorUserId: U.minhquy!.id, title: 'Lộ trình Funnel Money Model 2026: bắt đầu từ đâu?', contentMd: 'Chào cả nhà. Tuần này mình mở lại toàn bộ module 1 cho thành viên miễn phí. Ai mới vào hãy học 5 bài đầu trước rồi đặt câu hỏi ở mục Hỏi đáp, mình và các cộng sự trả lời trong 24 giờ.\n\n## Lộ trình\n\n1. Học module 1 (miễn phí)\n2. Làm bài tập Offer Canvas\n3. Đặt câu hỏi ở Hỏi đáp', excerpt: 'Chào cả nhà. Tuần này mình mở lại toàn bộ module 1 cho thành viên miễn phí. Ai mới vào hãy học 5 bài đầu trước rồi đặt câu hỏi ở mục Hỏi đáp, mình và các cộng sự trả lời trong 24 giờ.', pinned: true, likeCount: 24, commentCount: 8, lastCommentAt: daysFrom(base, 0, 7), createdAt: daysFrom(base, -2, 9) },
      { id: ids.status, communityId: c.id, spaceId: c.spaces['chia-se']!, authorUserId: U.kienbui!.id, title: '', contentMd: 'Vừa học xong module 1. Tối nay ai cùng làm bài tập Offer Canvas không?', excerpt: 'Vừa học xong module 1. Tối nay ai cùng làm bài tập Offer Canvas không?', statusBgKey: 'ngoc', likeCount: 6, commentCount: 3, createdAt: new Date(Date.now() - 40 * 60_000) },
      { id: ids.question, communityId: c.id, spaceId: c.spaces['hoi-dap']!, authorUserId: U.cong!.id, title: 'Mới thanh toán Premium nhưng chưa thấy khóa học mở?', contentMd: 'Mình vừa chuyển khoản gói tháng lúc 9 giờ sáng, đã nhận email xác nhận nhưng vào mục Khóa học vẫn thấy khóa. Cần chờ bao lâu ạ?', excerpt: 'Mình vừa chuyển khoản gói tháng lúc 9 giờ sáng, đã nhận email xác nhận nhưng vào mục Khóa học vẫn thấy khóa. Cần chờ bao lâu ạ?', likeCount: 3, commentCount: 2, lastCommentAt: daysFrom(base, 0, 8), createdAt: new Date(Date.now() - 3 * 3_600_000) },
      { id: ids.diary, communityId: c.id, spaceId: c.spaces['nhat-ky']!, authorUserId: U.dien!.id, title: 'Ngày 3: đơn đầu tiên từ funnel affiliate', contentMd: DIARY_MD, excerpt: 'Sau khi làm lại lead magnet theo bài 2.3, mình chạy 200k tiền ads và có 41 email, 1 đơn 490k. Chưa lãi nhưng tự tin hơn nhiều. Dưới đây là toàn bộ số liệu, ảnh chụp dashboard và 3 điều mình rút ra…', likeCount: 17, commentCount: 6, editedAt: daysFrom(base, -1, 22), lastCommentAt: daysFrom(base, 0, 6), createdAt: daysFrom(base, -1, 21, 14) },
      { id: ids.leadmagnet, communityId: c.id, spaceId: c.spaces['chia-se']!, authorUserId: U.hoangvu!.id, title: 'Lead magnet 1 trang kéo 41 email trong 3 ngày, mình làm thế nào', contentMd: 'Không cần landing page dài. Một trang, một lời hứa, một nút. Chi tiết từng bước và file template ở dưới.\n\n## Bước 1: lời hứa\n\nViết một câu duy nhất.', excerpt: 'Không cần landing page dài. Một trang, một lời hứa, một nút. Chi tiết từng bước và file template ở dưới.', likeCount: 58, commentCount: 21, createdAt: daysFrom(base, -2, 15) },
      { id: ids.month8, communityId: c.id, spaceId: c.spaces['nhat-ky']!, authorUserId: U.hoangvu!.id, title: 'Tháng 8: 23 người trả phí qua link, mình học được 3 điều', contentMd: 'Người ta mua vì tin người giới thiệu, không phải vì giảm giá. Nói thật về kết quả của mình quan trọng hơn mọi kỹ thuật.', excerpt: 'Người ta mua vì tin người giới thiệu, không phải vì giảm giá. Nói thật về kết quả của mình quan trọng hơn mọi kỹ thuật.', likeCount: 97, commentCount: 34, createdAt: daysFrom(base, -13, 10) },
      { id: ids.poll, communityId: c.id, spaceId: c.spaces['hoi-dap']!, authorUserId: U.minhquy!.id, title: 'Buổi Q&A tuần sau nên tập trung chủ đề nào?', contentMd: 'Bình chọn giúp mình để sắp thứ tự nội dung.', excerpt: 'Bình chọn giúp mình để sắp thứ tự nội dung.', likeCount: 9, commentCount: 1, createdAt: daysFrom(base, -3, 20) },
    ])
    .onConflictDoNothing();

  for (const [i, color] of IMAGE_COLORS.entries()) {
    await db.insert(postImages).values({ id: await sid(`postimg:diary:${i}`), postId: ids.diary, url: placeholderImage(color), width: 1200, height: 800, sortOrder: i }).onConflictDoNothing();
  }

  const pollId = await sid('poll:kd:1');
  await db.insert(polls).values({ id: pollId, postId: ids.poll, question: 'Buổi Q&A tuần sau nên tập trung chủ đề nào?', multipleChoice: false, closesAt: daysFrom(base, 5) }).onConflictDoNothing();
  const optA = await sid('pollopt:kd:1:a');
  const optB = await sid('pollopt:kd:1:b');
  const optC = await sid('pollopt:kd:1:c');
  await db
    .insert(pollOptions)
    .values([
      { id: optA, pollId, label: 'Lead magnet và Tripwire', sortOrder: 0, voteCount: 2 },
      { id: optB, pollId, label: 'Chạy ads về trang giới thiệu hội', sortOrder: 1, voteCount: 1 },
      { id: optC, pollId, label: 'Thiết kế hoa hồng cộng sự', sortOrder: 2, voteCount: 0 },
    ])
    .onConflictDoNothing();
  await db
    .insert(pollVotes)
    .values([
      { id: await sid('pollvote:1'), pollId, optionId: optA, userId: U.hoangvu!.id },
      { id: await sid('pollvote:2'), pollId, optionId: optA, userId: U.dien!.id },
      { id: await sid('pollvote:3'), pollId, optionId: optB, userId: U.hongkim!.id },
    ])
    .onConflictDoNothing();

  const cHv = await sid('comment:diary:hv');
  const cHk = await sid('comment:diary:hk');
  await db
    .insert(comments)
    .values([
      { id: cHv, communityId: c.id, targetType: 'post', targetId: ids.diary, authorUserId: U.hoangvu!.id, contentMd: 'Rất chuẩn. Bổ sung: đừng đổi ảnh và ngân sách cùng lúc, đổi một thứ mỗi tuần thì mới biết cái nào ăn. Mình gửi bạn bảng theo dõi mình đang dùng.', imageUrl: placeholderImage('#3E5C7A', 800, 460), pinned: true, likeCount: 9, replyCount: 3, createdAt: daysFrom(base, 0, -9) },
      { id: await sid('comment:diary:dn1'), communityId: c.id, targetType: 'post', targetId: ids.diary, authorUserId: U.dien!.id, parentCommentId: cHv, contentMd: 'Cảm ơn anh @hoang-vu, tuần sau em chỉ đổi ngân sách thôi, giữ nguyên ảnh.', likeCount: 2, createdAt: daysFrom(base, 0, -8) },
      { id: await sid('comment:diary:mq'), communityId: c.id, targetType: 'post', targetId: ids.diary, authorUserId: U.minhquy!.id, parentCommentId: cHv, contentMd: 'Bài này mình sẽ đưa vào phần *Câu chuyện* của hội, cả nhà mới vào đọc bài này trước nhé. **Số liệu thật** luôn thuyết phục hơn lý thuyết.', likeCount: 14, createdAt: daysFrom(base, 0, -6) },
      { id: cHk, communityId: c.id, targetType: 'post', targetId: ids.diary, authorUserId: U.hongkim!.id, contentMd: 'Cho mình hỏi bạn chạy ads về trang lead magnet trên Hội Mình hay trang ngoài? Mình đang phân vân vì trang ngoài phải làm thêm bước.', likeCount: 3, replyCount: 1, createdAt: daysFrom(base, 0, -3) },
      { id: await sid('comment:diary:dn2'), communityId: c.id, targetType: 'post', targetId: ids.diary, authorUserId: U.dien!.id, parentCommentId: cHk, contentMd: 'Trang lead magnet mình dựng ngoài, còn tin nhắn chào và khóa học thì ở đây. Sắp tới thử dùng luôn trang giới thiệu hội xem sao.', likeCount: 1, createdAt: daysFrom(base, 0, -2) },
      { id: await sid('comment:diary:kb'), communityId: c.id, targetType: 'post', targetId: ids.diary, authorUserId: U.kienbui!.id, contentMd: 'Lưu bài. Đúng cái mình cần cho tuần này 🙏', likeCount: 0, createdAt: daysFrom(base, 0, 6) },
      { id: await sid('comment:question:mq'), communityId: c.id, targetType: 'post', targetId: ids.question, authorUserId: U.minhquy!.id, contentMd: 'Quyền truy cập được mở tự động sau khi ngân hàng báo có, thường dưới 1 phút. Bạn tải lại trang Khóa học giúp mình nhé.', likeCount: 2, createdAt: daysFrom(base, 0, 8) },
      { id: await sid('comment:question:ct'), communityId: c.id, targetType: 'post', targetId: ids.question, authorUserId: U.cong!.id, contentMd: 'Cảm ơn anh, em đã vào học được rồi ạ', likeCount: 1, createdAt: new Date(Date.now() - 25 * 60_000) },
      { id: await sid('comment:status:hv'), communityId: c.id, targetType: 'post', targetId: ids.status, authorUserId: U.hoangvu!.id, contentMd: 'Mình tham gia, 21:00 nhé.', likeCount: 1, createdAt: new Date(Date.now() - 20 * 60_000) },
    ])
    .onConflictDoNothing();

  const likers = ['minhquy', 'hoangvu', 'hongkim', 'kienbui', 'duy', 'thulan', 'member1', 'member2', 'member3'];
  for (const [i, k] of likers.entries()) {
    await db.insert(reactions).values({ id: await sid(`react:diary:${k}`), userId: U[k]!.id, targetType: 'post', targetId: ids.diary, createdAt: daysFrom(base, 0, i) }).onConflictDoNothing();
    await db.insert(reactions).values({ id: await sid(`react:pinned:${k}`), userId: U[k]!.id, targetType: 'post', targetId: ids.pinned }).onConflictDoNothing();
  }
  return ids;
}
