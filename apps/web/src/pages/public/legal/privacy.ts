// Nội dung trang Chính sách quyền riêng tư (/quyen-rieng-tu). Chỉ có chữ, không có giao diện: xem cách viết ở `types.ts`.
//
// BẢN NHÁP soạn theo cách sản phẩm đang chạy, chủ dự án (và luật sư nếu cần) phải đọc duyệt trước khi coi là chính thức.
// Mỗi mục dưới đây ứng với một chỗ trong mã. Sửa mã thì sửa chữ ở đây và đổi ngày `updatedAt`:
//   - Dữ liệu thu: các bảng trong packages/db/src/schema.
//   - Cookie: apps/api/src/lib/session-cookie.ts (hm_at, hm_rt, hm_li), apps/api/src/routes/payer.ts (hm_ref, hm_vid),
//     apps/web/src/lib/referral.ts. Hạn phiên: packages/core/src/auth/service.ts (1 ngày hoặc 7 ngày, làm mới trong 30 ngày).
//   - Bộ nhớ trình duyệt: các khóa bắt đầu bằng "hm_" trong apps/web/src và packages/ui/src.
//   - Bên thứ ba: apps/api/wrangler.toml (Cloudflare, cơ sở dữ liệu Supabase tại Singapore), packages/email (Resend),
//     packages/payments (SePay, MoMo, VNPAY, PayPal, Stripe), packages/core/src/lib/web-push.ts (thông báo đẩy),
//     apps/web/index.html (Google Fonts), packages/contracts/src/learning.ts (video nhúng).
//   - Chưa có chức năng tự xóa tài khoản và tự tải dữ liệu: khi làm xong thì viết lại phần Xóa tài khoản và Quyền của bạn.
import type { LegalDoc } from './types';

export const PRIVACY: LegalDoc = {
  path: '/quyen-rieng-tu',
  title: 'Chính sách quyền riêng tư',
  updatedAt: '22/11/2026',
  intro: [
    'Trang này nói rõ Hội Mình thu những dữ liệu gì của bạn, dùng để làm gì, ai xem được, và bạn làm gì được với dữ liệu của mình.',
    'Chính sách này đi cùng [Điều khoản sử dụng](/dieu-khoan). Hội Mình xử lý dữ liệu cá nhân theo quy định pháp luật Việt Nam về bảo vệ dữ liệu cá nhân.',
  ],
  sections: [
    {
      id: 'tom-tat',
      title: 'Tóm tắt nhanh',
      blocks: [
        {
          type: 'list',
          items: [
            'Hội Mình chỉ thu dữ liệu cần để dịch vụ chạy: tài khoản, nội dung bạn đăng, việc học và đơn hàng.',
            'Hội Mình không bán dữ liệu của bạn. Hiện Hội Mình không gắn công cụ theo dõi quảng cáo hay công cụ phân tích truy cập của bên khác.',
            'Mật khẩu chỉ được lưu ở dạng đã băm. Hội Mình không đọc được mật khẩu của bạn.',
            'Hội Mình không nhận và không lưu số thẻ của bạn.',
            'Chủ hội của hội bạn tham gia xem được một số thông tin của bạn, ví dụ tên, email và đơn hàng trong hội đó.',
            'Dữ liệu được lưu trên máy chủ của nhà cung cấp hạ tầng ở nước ngoài. Cơ sở dữ liệu đặt tại Singapore.',
            'Hiện chưa có nút tự xóa tài khoản. Muốn xóa, bạn gửi yêu cầu cho Hội Mình.',
          ],
        },
      ],
    },
    {
      id: 'du-lieu-thu',
      title: 'Hội Mình thu những dữ liệu gì',
      blocks: [
        { type: 'h', text: 'Tài khoản' },
        {
          type: 'list',
          items: [
            'Tên hiển thị, email, tên người dùng trên đường dẫn hồ sơ.',
            'Mật khẩu, chỉ lưu bản đã băm một chiều.',
            'Thời điểm xác minh email, ngôn ngữ, múi giờ, lần hoạt động gần nhất.',
            'Nếu bạn bật xác thực hai lớp: khóa bí mật (được mã hóa khi lưu) và mã dự phòng (chỉ lưu bản băm).',
          ],
        },
        { type: 'h', text: 'Hồ sơ (bạn tự điền, không bắt buộc)' },
        { type: 'p', text: 'Ảnh đại diện, ảnh bìa, lời giới thiệu, nơi ở, nghề nghiệp, các liên kết (ví dụ Facebook, Zalo) và các lựa chọn quyền riêng tư của hồ sơ.' },
        { type: 'h', text: 'Nội dung bạn tạo' },
        { type: 'p', text: 'Bài viết, ảnh, bình luận, cảm xúc, bình chọn, câu trả lời khi xin vào hội, câu hỏi ở sự kiện và các tệp bạn tải lên.' },
        { type: 'h', text: 'Tin nhắn' },
        { type: 'p', text: 'Nội dung tin nhắn riêng, ảnh và tệp đính kèm, trạng thái đã nhận và đã xem, danh sách người bạn chặn, và các báo cáo bạn gửi. Tin nhắn được lưu trên máy chủ để hai bên xem lại. Tin nhắn không được mã hóa đầu cuối.' },
        { type: 'h', text: 'Việc học và tham gia' },
        { type: 'p', text: 'Các hội bạn tham gia, gói thành viên, ngày tham gia, lần hoạt động gần nhất trong hội, tiến độ từng bài và từng khóa học, chứng nhận hoàn thành, sự kiện bạn đăng ký.' },
        { type: 'h', text: 'Đơn hàng và thanh toán' },
        {
          type: 'list',
          items: [
            'Đơn hàng, số tiền, cách thanh toán, mã đơn, trạng thái, biên nhận và các lần hoàn tiền.',
            'Thông báo giao dịch mà ngân hàng hoặc cổng thanh toán gửi về (ví dụ số tiền, nội dung chuyển khoản, mã giao dịch), được lưu để xác nhận và đối soát.',
            'Hội Mình không nhận và không lưu số thẻ: thẻ được nhập trên trang của cổng thanh toán.',
          ],
        },
        { type: 'h', text: 'Tài khoản nhận tiền' },
        {
          type: 'list',
          items: [
            '**Của affiliate:** ngân hàng, số tài khoản và tên chủ tài khoản để nhận hoa hồng. Thông tin này được mã hóa khi lưu. Số tài khoản đầy đủ chỉ hiện cho người chi trả khi họ xử lý yêu cầu rút của bạn, và mỗi lần mở đều được ghi vào nhật ký.',
            '**Của chủ hội:** ngân hàng, số tài khoản và tên chủ tài khoản nhận tiền của hội (hiện cho người mua lúc thanh toán để họ chuyển khoản), cùng khóa kết nối cổng thanh toán của chủ hội (được mã hóa khi lưu và không hiện lại).',
          ],
        },
        { type: 'h', text: 'Link giới thiệu' },
        { type: 'p', text: 'Khi bạn mở một link giới thiệu, hệ thống ghi một lượt bấm gồm: một mã khách ngẫu nhiên, địa chỉ mạng (IP) và thông tin trình duyệt ở dạng đã băm, trang bạn mở và trang bạn vừa đi từ đó tới. Dữ liệu này dùng để đếm lượt bấm, lọc lượt bấm lặp và ghi nhận người giới thiệu.' },
        { type: 'h', text: 'Kỹ thuật và an toàn' },
        {
          type: 'list',
          items: [
            'Phiên đăng nhập: mã phiên (chỉ lưu bản băm), thông tin trình duyệt, địa chỉ mạng ở dạng đã băm và hạn dùng.',
            'Nhật ký hoạt động: các thao tác quan trọng như tạo đơn, thanh toán, hoàn tiền, rút hoa hồng, thay đổi thành viên, kèm thời điểm và địa chỉ mạng ở dạng đã băm.',
            'Nhật ký email đã gửi: địa chỉ nhận, loại thư, tiêu đề và trạng thái gửi.',
            'Nếu bạn bật thông báo đẩy: địa chỉ nhận thông báo do trình duyệt cấp cho từng thiết bị, khóa mã hóa đi kèm và thông tin trình duyệt.',
          ],
        },
        { type: 'h', text: 'Danh sách liên hệ do chủ hội đưa vào' },
        { type: 'p', text: 'Chủ hội có thể đưa vào Hội Mình email, tên và số điện thoại của những người đã để lại thông tin ở trang bán hàng riêng của họ. Với dữ liệu này, chủ hội là người thu thập và chịu trách nhiệm xin sự đồng ý, còn Hội Mình lưu và xử lý theo yêu cầu của chủ hội. Email quảng bá gửi theo danh sách này có link "Ngừng nhận email" ở cuối thư.' },
        { type: 'h', text: 'Những thứ Hội Mình không thu' },
        { type: 'p', text: 'Hội Mình không yêu cầu giấy tờ tùy thân, không lấy vị trí định vị của máy và không đọc danh bạ của bạn.' },
      ],
    },
    {
      id: 'muc-dich',
      title: 'Dùng dữ liệu để làm gì',
      blocks: [
        {
          type: 'list',
          items: [
            'Tạo tài khoản, cho bạn đăng nhập và giữ tài khoản an toàn.',
            'Hiện bài viết, bình luận, tin nhắn và hồ sơ của bạn cho đúng những người được xem.',
            'Ghi nhận thanh toán, mở quyền truy cập, lập biên nhận và xử lý hoàn tiền.',
            'Tính hoa hồng affiliate và xử lý yêu cầu rút tiền.',
            'Gửi email và thông báo: xác minh email, đặt lại mật khẩu, biên nhận, nhắc gia hạn, nhắc sự kiện, và hoạt động trong hội theo lựa chọn của bạn.',
            'Phát hiện gian lận, lạm dụng và xử lý báo cáo vi phạm.',
            'Sửa lỗi và vận hành hệ thống.',
          ],
        },
        { type: 'p', text: 'Hội Mình xử lý dữ liệu dựa trên sự đồng ý của bạn khi tạo tài khoản, để thực hiện dịch vụ bạn yêu cầu, và để làm đúng nghĩa vụ theo pháp luật. Hội Mình không dùng dữ liệu của bạn để bán quảng cáo.' },
      ],
    },
    {
      id: 'ai-xem-duoc',
      title: 'Ai xem được dữ liệu của bạn',
      blocks: [
        {
          type: 'list',
          items: [
            '**Thành viên khác trong hội:** tên, ảnh đại diện, hồ sơ, bài viết và bình luận của bạn trong hội đó.',
            '**Chủ hội và người quản lý hội:** tên, email, gói, ngày tham gia, lần hoạt động gần nhất, tiến độ học các khóa của hội, câu trả lời khi xin vào hội, đơn hàng và số tiền bạn đã trả trong hội đó, người giới thiệu của bạn. Họ có thể xuất danh sách thành viên ra tệp, hoặc kết nối API để đưa dữ liệu của hội sang hệ thống riêng. Chủ hội chịu trách nhiệm về cách họ dùng dữ liệu đó.',
            '**Người giới thiệu của bạn:** tên của bạn, món bạn mua và số tiền dùng để tính hoa hồng.',
            '**Bảng xếp hạng affiliate của hội:** tên và thành tích giới thiệu, có thể kèm số tiền nếu chủ hội bật.',
            '**Người có link chứng nhận:** trang chứng nhận hoàn thành khóa học là trang công khai, ai có link cũng xem được tên bạn, tên khóa học và ngày hoàn thành.',
            '**Người chi trả hoa hồng** (chủ hội, hoặc Hội Mình với chương trình của Hội Mình): tài khoản ngân hàng của bạn khi xử lý yêu cầu rút.',
            '**Quản trị viên Hội Mình:** dữ liệu cần để vận hành, hỗ trợ, đối soát thanh toán và xử lý báo cáo vi phạm.',
            '**Cơ quan nhà nước có thẩm quyền:** khi pháp luật yêu cầu.',
          ],
        },
        { type: 'p', text: 'Ở trang [Hồ sơ](/tai-khoan/ho-so), mục Quyền riêng tư, bạn tự bật tắt được: hiện hồ sơ với người chưa tham gia hội, hiện tiến độ học trên hồ sơ, hiện các hội bạn tham gia, và cho phép thành viên khác nhắn tin cho bạn.' },
      ],
    },
    {
      id: 'ben-thu-ba',
      title: 'Bên thứ ba nhận dữ liệu',
      blocks: [
        { type: 'p', text: 'Hội Mình không bán dữ liệu cho ai. Để dịch vụ chạy được, dữ liệu đi qua hoặc được lưu ở các bên sau:' },
        {
          type: 'list',
          items: [
            '**Cloudflare:** chạy web và máy chủ của Hội Mình, lưu ảnh và tệp bạn tải lên, xử lý ảnh, và giữ kết nối để tin nhắn, thông báo tới ngay. Mọi yêu cầu của bạn tới Hội Mình đều đi qua Cloudflare.',
            '**Supabase:** cơ sở dữ liệu của Hội Mình, đặt tại trung tâm dữ liệu ở Singapore. Đây là nơi lưu tài khoản, nội dung và đơn hàng.',
            '**Resend:** gửi email. Resend nhận địa chỉ email, tên của bạn và nội dung thư.',
            '**Dịch vụ thông báo đẩy của hãng trình duyệt** (ví dụ Google, Apple, Mozilla): chỉ khi bạn bật thông báo đẩy. Nội dung thông báo được mã hóa trước khi gửi qua các dịch vụ này.',
            '**Ngân hàng và cổng thanh toán:** khi bạn thanh toán, cổng bạn chọn (MoMo, VNPAY, PayPal, Stripe, hoặc SePay với chuyển khoản mua gói Hội Mình) nhận mã đơn, số tiền, mô tả đơn và có thể cả email của bạn. Đơn mua trong hội đi qua cổng do chủ hội kết nối. Đơn mua gói Hội Mình đi qua cổng của Hội Mình.',
            '**Dịch vụ tạo mã QR chuyển khoản** (VietQR, SePay): trình duyệt của bạn tải ảnh mã QR từ dịch vụ này. Địa chỉ ảnh chứa số tài khoản người nhận, số tiền và nội dung chuyển khoản.',
            '**Nơi phát video và tài liệu nhúng** (ví dụ YouTube, Vimeo, Facebook, TikTok, Google Drive): khi bạn mở một bài có nội dung nhúng, trình duyệt của bạn kết nối thẳng tới dịch vụ đó. Video YouTube được nhúng ở chế độ hạn chế cookie.',
            '**Google Fonts:** phông chữ của trang được tải từ Google, nên Google thấy địa chỉ mạng và thông tin trình duyệt của bạn khi tải phông.',
            '**Đăng nhập bằng Google:** nếu chức năng này được bật và bạn chọn dùng, Google xác nhận danh tính của bạn và Hội Mình nhận email và tên của bạn từ Google.',
          ],
        },
        { type: 'p', text: 'Vì một số bên ở trên đặt máy chủ ngoài Việt Nam, dữ liệu của bạn được lưu và xử lý ở nước ngoài. Mỗi bên có chính sách quyền riêng tư riêng.' },
      ],
    },
    {
      id: 'cookie',
      title: 'Cookie và bộ nhớ trình duyệt',
      blocks: [
        { type: 'p', text: 'Hội Mình chỉ dùng cookie của chính mình, để đăng nhập và để ghi nhận link giới thiệu. Hội Mình không dùng cookie quảng cáo.' },
        { type: 'h', text: 'Cookie' },
        {
          type: 'list',
          items: [
            '**hm_at:** giữ phiên đăng nhập. Hạn 7 ngày nếu bạn chọn ghi nhớ đăng nhập, không thì 1 ngày. Mã trong trang không đọc được cookie này.',
            '**hm_rt:** làm mới phiên đăng nhập để bạn không phải đăng nhập lại liên tục. Hạn 30 ngày. Mã trong trang không đọc được cookie này.',
            '**hm_li:** chỉ đánh dấu là bạn đang đăng nhập, không chứa bí mật. Hạn 30 ngày.',
            '**hm_ref:** nhớ mã giới thiệu của link bạn đã bấm. Hạn 30 ngày.',
            '**hm_vid:** một mã khách ngẫu nhiên, để tải lại trang không bị đếm thêm lượt bấm. Hạn 365 ngày. Chỉ được tạo khi bạn mở một link giới thiệu.',
          ],
        },
        { type: 'h', text: 'Bộ nhớ trình duyệt' },
        { type: 'p', text: 'Một số lựa chọn được lưu ngay trên máy của bạn, không gắn với việc theo dõi:' },
        {
          type: 'list',
          items: [
            'Lưu lâu dài trên máy: giao diện sáng hoặc tối, thanh bên thu gọn hay mở, hội bạn mở gần nhất, chuyên mục đăng bài gần nhất, chất lượng video, chương trình affiliate đang xem, lần gần nhất được hỏi bật thông báo, và số lần bạn vào ứng dụng (để nhắc cài ra màn hình chính).',
            'Chỉ lưu tới khi đóng thẻ: trang cần quay lại sau khi đăng nhập, mã giới thiệu đã được đếm, và trạng thái cập nhật phiên bản.',
          ],
        },
        { type: 'p', text: 'Bạn xóa cookie và bộ nhớ này được trong phần cài đặt của trình duyệt. Xóa cookie đăng nhập thì bạn sẽ bị đăng xuất.' },
      ],
    },
    {
      id: 'luu-giu',
      title: 'Lưu ở đâu, giữ bao lâu, bảo vệ thế nào',
      blocks: [
        { type: 'h', text: 'Thời gian lưu' },
        { type: 'p', text: 'Hội Mình giữ dữ liệu chừng nào tài khoản của bạn còn tồn tại. Hiện Hội Mình chưa đặt thời hạn tự xóa riêng cho từng loại dữ liệu. Một số mốc đang chạy thật:' },
        {
          type: 'list',
          items: [
            'Bài viết, bình luận bạn xóa: ẩn ngay với mọi người (bản ghi được đánh dấu là đã xóa). Ảnh và tệp đính kèm của chúng được gỡ khỏi kho lưu trữ.',
            'Tin nhắn bạn thu hồi (trong 24 giờ sau khi gửi): nội dung bị xóa, ảnh và tệp đính kèm được gỡ khỏi kho lưu trữ.',
            'Phiên đăng nhập: hết hạn sau 30 ngày.',
            'Việc ghi nhận người giới thiệu từ một lượt bấm link: hết hiệu lực sau 30 ngày. Bản ghi lượt bấm vẫn được giữ để thống kê.',
            'Đăng ký thông báo đẩy: bị xóa khi thiết bị không còn nhận thông báo.',
            'Đơn hàng, biên nhận, sổ hoa hồng và nhật ký hoạt động: được giữ lại để đối soát, giải quyết tranh chấp và theo quy định pháp luật về kế toán, thuế.',
          ],
        },
        { type: 'h', text: 'Bảo vệ' },
        {
          type: 'list',
          items: [
            'Kết nối tới Hội Mình được mã hóa (HTTPS).',
            'Mật khẩu được băm một chiều. Tài khoản nhận hoa hồng, khóa cổng thanh toán của chủ hội và khóa xác thực hai lớp được mã hóa khi lưu.',
            'Phiên đăng nhập nằm trong cookie mà mã chạy trong trang không đọc được.',
            'Có giới hạn số lần gọi để chống dò mật khẩu, và có nhật ký cho các thao tác quan trọng.',
          ],
        },
        { type: 'p', text: 'Không hệ thống nào an toàn tuyệt đối. Nếu xảy ra sự cố ảnh hưởng tới dữ liệu của bạn, Hội Mình sẽ thông báo theo quy định pháp luật.' },
      ],
    },
    {
      id: 'xoa-tai-khoan',
      title: 'Xóa tài khoản',
      blocks: [
        { type: 'note', text: 'Hiện Hội Mình **chưa có nút tự xóa tài khoản** trong ứng dụng. Muốn xóa, bạn gửi yêu cầu cho Hội Mình (xem phần Liên hệ). Yêu cầu được xử lý bằng tay.' },
        { type: 'p', text: 'Khi xử lý yêu cầu xóa:' },
        {
          type: 'list',
          items: [
            'Thông tin đăng nhập và hồ sơ cá nhân của bạn được xóa hoặc ẩn danh.',
            'Dữ liệu giao dịch (đơn hàng, biên nhận, hoa hồng) và nhật ký cần cho đối soát, kế toán và giải quyết tranh chấp có thể được giữ lại theo quy định pháp luật.',
            'Nếu bạn là chủ hội, bạn cần xử lý xong việc của hội trước: thành viên đang trả phí, đơn chờ hoàn tiền, hoa hồng chưa trả.',
          ],
        },
        { type: 'p', text: 'Trong lúc chờ, bạn tự làm được ngay: xóa bài viết và bình luận, xóa thông tin trong hồ sơ, tắt gia hạn các gói, tắt thông báo và đăng xuất.' },
      ],
    },
    {
      id: 'quyen-cua-ban',
      title: 'Quyền của bạn và cách thực hiện',
      blocks: [
        {
          type: 'list',
          items: [
            '**Xem và sửa:** vào trang [Hồ sơ](/tai-khoan/ho-so) để xem, sửa tên, ảnh, lời giới thiệu, liên kết và đổi mật khẩu. Hiện chưa có nút tự đổi email đăng nhập: cần đổi thì bạn liên hệ Hội Mình.',
            '**Chọn ai xem được gì:** bốn công tắc ở mục Quyền riêng tư của trang Hồ sơ.',
            '**Xóa nội dung:** tự xóa bài viết, bình luận của mình. Thu hồi tin nhắn trong 24 giờ sau khi gửi.',
            '**Chặn:** chặn một người để hai bên không nhắn tin được cho nhau.',
            '**Thông báo:** ở trang [Thông báo](/thong-bao), bạn bật tắt email tổng hợp, thông báo lượt thích và mức thông báo của từng hội. Thông báo đẩy thì tắt trong cài đặt của trình duyệt hoặc điện thoại. Email hệ thống như xác minh, đặt lại mật khẩu, biên nhận vẫn được gửi.',
            '**Xem đơn hàng và biên nhận:** ở trang [Gói và thanh toán](/tai-khoan/goi).',
            '**Rút lại đồng ý:** bạn ngừng dùng và yêu cầu xóa tài khoản bất cứ lúc nào. Với link giới thiệu, bạn xóa cookie trong trình duyệt. Với email quảng bá của chủ hội, bạn bấm "Ngừng nhận email" ở cuối thư.',
            '**Xin bản sao dữ liệu, yêu cầu hạn chế xử lý hoặc phản đối:** hiện chưa có nút tự tải dữ liệu, bạn gửi yêu cầu cho Hội Mình.',
          ],
        },
        { type: 'p', text: 'Bạn cũng có quyền khiếu nại tới cơ quan nhà nước có thẩm quyền theo quy định pháp luật Việt Nam về bảo vệ dữ liệu cá nhân.' },
      ],
    },
    {
      id: 'thay-doi',
      title: 'Thay đổi chính sách',
      blocks: [
        { type: 'p', text: 'Khi Hội Mình thay đổi cách thu hoặc dùng dữ liệu, chính sách này được sửa theo và ghi rõ ngày cập nhật ở đầu trang. Với thay đổi quan trọng, Hội Mình sẽ báo qua email hoặc thông báo trong ứng dụng.' },
      ],
    },
    {
      id: 'lien-he',
      title: 'Liên hệ',
      blocks: [{ type: 'contact' }],
    },
  ],
};
