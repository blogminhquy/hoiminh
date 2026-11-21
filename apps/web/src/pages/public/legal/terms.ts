// Nội dung trang Điều khoản sử dụng (/dieu-khoan). Chỉ có chữ, không có giao diện: xem cách viết ở `types.ts`.
//
// BẢN NHÁP soạn theo cách sản phẩm đang chạy, chủ dự án (và luật sư nếu cần) phải đọc duyệt trước khi coi là chính thức.
// Các con số dưới đây lấy từ mã, sửa mã thì sửa chữ ở đây và đổi ngày `updatedAt`:
//   - Hoàn tiền 7 ngày, xem chưa quá 20%: BUSINESS.courseRefundDays, BUSINESS.courseRefundMaxProgressPercent (packages/config).
//   - Giữ hoa hồng 14 ngày (hội), 30 ngày (nền tảng), rút tối thiểu 500.000đ, cookie giới thiệu 30 ngày: BUSINESS.communityHoldDays,
//     platformHoldDays, minWithdrawalMinor, affiliateCookieDays. Chủ hội chọn 7, 14 hoặc 30 ngày ở Cài đặt, Affiliate.
//   - Nhắc gia hạn gói trước 7, 3, 1 ngày: BUSINESS.planReminderDays. Bốn gói và bốn kỳ: packages/contracts/src/plans.ts.
//   - Thu hồi tin nhắn trong 24 giờ: RECALL_WINDOW_MS (packages/core/src/services/messaging.ts).
import type { LegalDoc } from './types';

export const TERMS: LegalDoc = {
  path: '/dieu-khoan',
  title: 'Điều khoản sử dụng',
  updatedAt: '22/11/2026',
  intro: [
    'Chào bạn. Đây là thỏa thuận giữa bạn và Hội Mình khi bạn dùng hoiminh.com. Hội Mình cố viết ngắn, nói thẳng và dễ hiểu.',
    'Khi tạo tài khoản hoặc tiếp tục dùng Hội Mình, bạn đồng ý với các điều khoản dưới đây và với [Chính sách quyền riêng tư](/quyen-rieng-tu). Nếu không đồng ý, bạn vui lòng không dùng dịch vụ.',
  ],
  sections: [
    {
      id: 'vai-tro',
      title: 'Hội Mình là gì, ai là ai',
      blocks: [
        { type: 'p', text: 'Hội Mình là nền tảng để người dạy và người bán mở hội (cộng đồng) của riêng mình: đăng bài, mở khóa học, tổ chức sự kiện, bán sản phẩm số và nhận thanh toán.' },
        { type: 'p', text: 'Trên Hội Mình có ba vai:' },
        {
          type: 'list',
          items: [
            '**Hội Mình** là bên cung cấp nền tảng: phần mềm, chỗ lưu dữ liệu và công cụ. Hội Mình không phải là người bán khóa học hay sản phẩm trong các hội.',
            '**Chủ hội** là người mở và điều hành một hội. Chủ hội là người bán: tự quyết định nội dung, giá và quy định của hội, và chịu trách nhiệm về những gì mình bán.',
            '**Thành viên** là người tham gia hội, người học và người mua.',
          ],
        },
        { type: 'p', text: 'Một người có thể giữ nhiều vai cùng lúc, ví dụ vừa là chủ hội này vừa là thành viên của hội khác. Người giới thiệu (affiliate) là người chia sẻ link giới thiệu để nhận hoa hồng, xem phần Affiliate và hoa hồng bên dưới.' },
      ],
    },
    {
      id: 'tai-khoan',
      title: 'Tài khoản của bạn',
      blocks: [
        { type: 'p', text: 'Bạn cần tài khoản để tham gia hội, mua hàng hoặc mở hội. Khi đăng ký, bạn cho Hội Mình tên hiển thị, email và mật khẩu.' },
        {
          type: 'list',
          items: [
            'Dùng email bạn đang dùng thật. Mã xác minh, biên nhận và các thông báo quan trọng được gửi về email đó.',
            'Giữ kín mật khẩu. Những gì xảy ra dưới tài khoản của bạn thì bạn chịu trách nhiệm, trừ khi do lỗi của Hội Mình.',
            'Bạn có thể bật xác thực hai lớp bằng ứng dụng tạo mã ở trang [Hồ sơ](/tai-khoan/ho-so) để tài khoản an toàn hơn.',
            'Không tạo tài khoản giả, không mạo danh người khác hay tổ chức khác.',
            'Bạn cần đủ 18 tuổi để mở hội, bán hàng hoặc nhận hoa hồng. Nếu chưa đủ 18 tuổi, bạn chỉ dùng Hội Mình khi cha mẹ hoặc người giám hộ đồng ý.',
          ],
        },
        { type: 'p', text: 'Nếu nghi tài khoản bị người khác dùng, hãy đổi mật khẩu ngay ở trang Hồ sơ (có lựa chọn đăng xuất khỏi các thiết bị khác) rồi báo cho Hội Mình.' },
      ],
    },
    {
      id: 'tien-di-dau',
      title: 'Mua bán trong hội: tiền đi đâu',
      blocks: [
        { type: 'note', text: 'Khi bạn mua gói thành viên, khóa học hay sản phẩm của một hội, **tiền đi thẳng tới chủ hội**. Hội Mình không nhận, không giữ hộ và không thu phí trên các giao dịch đó.' },
        { type: 'p', text: 'Chủ hội tự cài cách nhận tiền cho hội của mình. Tùy hội, bạn có thể trả bằng:' },
        {
          type: 'list',
          items: [
            'Chuyển khoản bằng mã QR tới tài khoản ngân hàng của chủ hội.',
            'Cổng thanh toán do chính chủ hội đăng ký và kết nối: MoMo, VNPAY, PayPal, hoặc thẻ Visa, Mastercard qua Stripe.',
          ],
        },
        { type: 'p', text: 'Hội nào chưa cài cách nhận tiền thì hội đó chưa bán được.' },
        { type: 'p', text: 'Sau khi bạn trả tiền, quyền của bạn được mở theo một trong hai cách: hệ thống tự xác nhận khi ngân hàng hoặc cổng thanh toán báo về, hoặc chủ hội kiểm tra tài khoản rồi bấm xác nhận. Với đơn chủ hội xác nhận bằng tay, bạn có thể phải chờ chủ hội kiểm tra.' },
        { type: 'p', text: 'Vì chủ hội là người bán và là người nhận tiền, mọi việc về sản phẩm, chất lượng nội dung, hóa đơn, thuế và hoàn tiền của đơn đó là việc giữa bạn và chủ hội. Hội Mình cung cấp công cụ để ghi nhận đơn, mở quyền truy cập và để hai bên nhắn tin cho nhau, nhưng không đứng ra bán và không bảo lãnh cho giao dịch.' },
        { type: 'p', text: 'Biên nhận bạn xem được ở trang [Gói và thanh toán](/tai-khoan/goi) chỉ ghi lại giao dịch, không phải hóa đơn giá trị gia tăng. Cần hóa đơn thì bạn hỏi chủ hội.' },
        { type: 'p', text: 'Với gói thành viên trả theo kỳ: Hội Mình không lưu thẻ và không tự trừ tiền của bạn. Hết kỳ, muốn dùng tiếp thì bạn thanh toán kỳ mới. Bạn tắt gia hạn được bất cứ lúc nào ở trang Gói và thanh toán và vẫn giữ quyền tới hết kỳ đã trả.' },
      ],
    },
    {
      id: 'hoan-tien',
      title: 'Hoàn tiền',
      blocks: [
        { type: 'p', text: 'Người hoàn tiền cho một đơn mua trong hội là chủ hội, vì chủ hội là người đã nhận tiền.' },
        { type: 'h', text: 'Tự yêu cầu hoàn tiền cho sản phẩm mua lẻ' },
        { type: 'p', text: 'Với sản phẩm mua lẻ trong Cửa hàng của hội (khóa học, combo, sản phẩm số), bạn tự bấm yêu cầu hoàn tiền được khi đủ các điều kiện sau:' },
        {
          type: 'list',
          items: [
            'Đơn đã thanh toán và chưa quá 7 ngày kể từ lúc thanh toán.',
            'Nếu sản phẩm là một khóa học: bạn xem chưa quá 20% nội dung khóa đó.',
          ],
        },
        { type: 'p', text: 'Nút yêu cầu nằm cạnh đơn hàng ở trang [Gói và thanh toán](/tai-khoan/goi). Đủ điều kiện thì hệ thống ghi nhận hoàn tiền ngay và thu lại quyền truy cập sản phẩm đó.' },
        { type: 'h', text: 'Tiền về bằng cách nào' },
        {
          type: 'list',
          items: [
            'Bạn đã trả qua MoMo, PayPal hoặc Stripe của chủ hội: hệ thống gửi lệnh hoàn tiền qua chính cổng đó.',
            'Bạn đã trả bằng chuyển khoản hoặc VNPAY: chủ hội tự chuyển lại tiền cho bạn. Hệ thống chỉ ghi sổ, không chuyển tiền thay chủ hội.',
          ],
        },
        { type: 'p', text: 'Tiền về tài khoản nhanh hay chậm còn tùy chủ hội, ngân hàng và cổng thanh toán.' },
        { type: 'h', text: 'Các trường hợp khác' },
        {
          type: 'list',
          items: [
            'Gói thành viên của hội (trả theo kỳ hoặc trả một lần) không có nút tự yêu cầu hoàn tiền. Bạn nhắn chủ hội để hai bên thỏa thuận.',
            'Chủ hội có thể chủ động hoàn tiền cho bất kỳ đơn nào của hội mình, không phụ thuộc mốc 7 ngày hay tiến độ học.',
            'Chủ hội có thể ghi cam kết hoàn tiền riêng trên trang sản phẩm. Cam kết đó là lời hứa của chủ hội với bạn.',
          ],
        },
        { type: 'p', text: 'Nếu bạn đủ điều kiện mà chủ hội không hoàn tiền, hãy báo cho Hội Mình. Hội Mình không giữ tiền của đơn nên không hoàn thay chủ hội được, nhưng sẽ xem xét và có thể khóa hội vi phạm.' },
        { type: 'p', text: 'Khi một đơn được hoàn tiền, hoa hồng affiliate của đơn đó bị thu hồi.' },
      ],
    },
    {
      id: 'goi-hoi-minh',
      title: 'Gói Hội Mình dành cho chủ hội',
      blocks: [
        { type: 'p', text: 'Đây là khoản duy nhất chủ hội trả cho Hội Mình: phí dùng nền tảng. Hội Mình không thu phần trăm trên doanh thu của hội ở bất kỳ gói nào.' },
        { type: 'p', text: 'Hiện có bốn gói: Miễn phí, Khởi đầu, Chuyên nghiệp và Không giới hạn. Mỗi gói dùng cho một hội. Giá, số thành viên tối đa và tính năng của từng gói xem ở trang [Bảng giá](/tao-hoi/goi).' },
        {
          type: 'list',
          items: [
            '**Hội miễn phí.** Mỗi tài khoản có một hội dùng gói Miễn phí. Từ hội thứ hai trở đi cần gói trả phí còn hạn.',
            '**Trả trước theo kỳ.** Bạn chọn một kỳ đang bán (1 tháng, 3 tháng, 6 tháng hoặc 1 năm) và trả một lần cho cả kỳ. Tiền gói về tài khoản của Hội Mình, qua các cách thanh toán đang mở ở trang mua gói.',
            '**Không tự động trừ tiền.** Hội Mình không lưu thẻ và không tự gia hạn. Hội Mình gửi email nhắc trước ngày hết hạn 7 ngày, 3 ngày và 1 ngày.',
            '**Gia hạn.** Gia hạn trước khi hết hạn thì số ngày mới được nối tiếp vào ngày cũ, bạn không mất ngày nào.',
            '**Nâng gói.** Nâng lên gói cao hơn khi gói cũ còn hạn thì số ngày còn lại của gói cũ được cộng sang gói mới.',
            '**Xuống gói.** Gói thấp hơn chỉ mua được khi kỳ đang trả đã hết, và khi số thành viên của hội không vượt mức tối đa của gói đó.',
            '**Đổi giá.** Hội Mình có thể đổi giá và tính năng của các gói. Kỳ bạn đã trả tiền vẫn giữ nguyên tới hết hạn.',
          ],
        },
        { type: 'h', text: 'Ngừng dùng gói' },
        { type: 'p', text: 'Không có gì phải hủy: bạn chỉ cần không gia hạn. Khi gói hết hạn:' },
        {
          type: 'list',
          items: [
            'Hội miễn phí của bạn quay về gói Miễn phí. Các tính năng trả phí bị khóa lại. Nếu số thành viên đã vượt mức của gói Miễn phí, hội chưa nhận thêm thành viên mới cho tới khi bạn nâng gói.',
            'Hội thứ hai trở đi tạm ngừng: không đăng nội dung mới, không nhận thành viên mới cho tới khi có gói.',
            'Dữ liệu của hội vẫn được giữ.',
          ],
        },
        { type: 'p', text: 'Hội Mình chưa có nút tự yêu cầu hoàn tiền gói. Nếu bạn trả nhầm hoặc trả hai lần, hãy liên hệ Hội Mình để được xem xét.' },
      ],
    },
    {
      id: 'chu-hoi',
      title: 'Trách nhiệm của chủ hội',
      blocks: [
        { type: 'p', text: 'Nếu bạn mở hội, bạn là người bán và là người điều hành hội đó. Bạn cam kết:' },
        {
          type: 'list',
          items: [
            'Nội dung, khóa học và sản phẩm đúng như mô tả, và bạn có quyền dùng, quyền bán chúng.',
            'Trả lời thành viên, xử lý khiếu nại và hoàn tiền đúng luật hoàn tiền ở trên và đúng cam kết bạn tự ghi trên trang sản phẩm.',
            'Tài khoản ngân hàng và cổng thanh toán bạn kết nối là của bạn hoặc bạn được phép dùng, và bạn làm đúng điều khoản của ngân hàng, cổng thanh toán đó.',
            'Tự lo hóa đơn, kê khai và nộp thuế cho doanh thu của hội, và giấy phép nếu ngành nghề của bạn cần.',
            'Nếu bật affiliate cho hội: trả hoa hồng đầy đủ, đúng hạn cho người giới thiệu.',
            'Chỉ dùng thông tin của thành viên (tên, email, đơn hàng) để vận hành hội. Danh sách liên hệ bạn đưa từ ngoài vào Hội Mình phải là của những người đã đồng ý cho bạn liên lạc.',
            'Chịu trách nhiệm về những người bạn giao quyền quản trị, điều hành hội.',
            'Giữ bí mật các khóa API, địa chỉ nhận báo có và khóa cổng thanh toán của hội.',
          ],
        },
      ],
    },
    {
      id: 'affiliate',
      title: 'Affiliate và hoa hồng',
      blocks: [
        { type: 'p', text: 'Có hai loại chương trình giới thiệu:' },
        {
          type: 'list',
          items: [
            '**Chương trình của hội.** Chủ hội bật và đặt luật: tỷ lệ hoa hồng, số ngày giữ, mức rút tối thiểu. Hoa hồng do **chủ hội trả**.',
            '**Chương trình của Hội Mình.** Bạn giới thiệu người khác mua gói Hội Mình. Hoa hồng do **Hội Mình trả**.',
          ],
        },
        { type: 'h', text: 'Cách tính' },
        {
          type: 'list',
          items: [
            'Khi một người bấm link giới thiệu của bạn, trình duyệt của họ ghi nhớ mã của bạn trong 30 ngày.',
            'Trong một hội, mỗi thành viên chỉ có một người giới thiệu. Với người chưa ở trong hội, hệ thống tính lượt bấm cuối cùng trong 30 ngày. Thành viên đã có người giới thiệu thì người khác không giới thiệu tranh được. Thành viên có thể tự chọn hoặc đổi người giới thiệu của mình ở trang Xếp hạng affiliate của hội.',
            'Hoa hồng tính trên số tiền người mua thực trả, theo tỷ lệ của chương trình.',
            'Chủ hội có thể tắt hoa hồng cho từng khóa học bán lẻ.',
            'Hội chuyển sang gói không có tính năng affiliate thì các đơn mới của hội đó không sinh hoa hồng.',
          ],
        },
        { type: 'h', text: 'Thời gian giữ và rút tiền' },
        {
          type: 'list',
          items: [
            'Hoa hồng mới sinh ra được giữ một thời gian rồi mới rút được, để chờ qua hạn hoàn tiền. Mặc định là 14 ngày với chương trình của hội (chủ hội chọn 7, 14 hoặc 30 ngày) và 30 ngày với chương trình của Hội Mình.',
            'Mức rút tối thiểu mặc định là 500.000đ mỗi lần.',
            'Tỷ lệ, số ngày giữ và mức rút đang áp dụng cho bạn hiện ngay ở trang [Affiliate](/tai-khoan/cong-su) trong tài khoản của bạn.',
            'Để rút, bạn nhập tài khoản ngân hàng nhận tiền rồi gửi yêu cầu. Người trả (chủ hội, hoặc Hội Mình với chương trình của Hội Mình) xem xét, chuyển khoản cho bạn rồi đánh dấu đã trả.',
            'Yêu cầu rút có thể bị từ chối kèm lý do, khi đó số tiền quay lại ví. Bạn tự hủy được yêu cầu khi nó còn chờ duyệt.',
          ],
        },
        { type: 'h', text: 'Khi nào hoa hồng bị thu hồi' },
        { type: 'p', text: 'Đơn hàng được hoàn tiền thì hoa hồng của đơn đó bị thu hồi. Hoa hồng còn đang giữ thì bị hủy. Hoa hồng đã vào ví thì bị trừ lại khỏi ví.' },
        { type: 'h', text: 'Điều không được làm' },
        {
          type: 'list',
          items: [
            'Tự giới thiệu chính mình. Mua bằng link của chính bạn thì không có hoa hồng.',
            'Tạo tài khoản ảo, tự bấm link, spam, quảng cáo sai sự thật, hoặc mạo danh chủ hội hay Hội Mình để kiếm hoa hồng.',
          ],
        },
        { type: 'p', text: 'Người gian lận có thể bị khóa tài khoản và bị từ chối yêu cầu rút phần hoa hồng liên quan.' },
        { type: 'p', text: 'Với chương trình của hội, Hội Mình chỉ tính và ghi sổ hoa hồng. Hội Mình không giữ tiền của hội nên không trả thay chủ hội. Nếu chủ hội chậm trả, bạn báo cho Hội Mình.' },
        { type: 'p', text: 'Nghĩa vụ thuế với khoản hoa hồng (nếu có) thực hiện theo quy định pháp luật.' },
      ],
    },
    {
      id: 'noi-dung',
      title: 'Nội dung của bạn',
      blocks: [
        { type: 'p', text: 'Bài viết, bình luận, tin nhắn, bài giảng và tệp bạn đưa lên vẫn là của bạn.' },
        {
          type: 'list',
          items: [
            'Bạn cho phép Hội Mình lưu trữ, hiển thị và truyền nội dung đó tới những người được xem (thành viên của hội, người mua) để dịch vụ chạy được. Hội Mình không bán nội dung của bạn.',
            'Bạn cam kết có quyền với những gì mình đăng và nội dung đó không vi phạm quyền của người khác.',
            'Bạn xóa được bài viết và bình luận của mình, và thu hồi được tin nhắn trong 24 giờ sau khi gửi. Chủ hội và người điều hành của hội cũng xóa được bài viết, bình luận trong hội đó.',
            'Khóa học và sản phẩm bạn mua là để bạn dùng. Không sao chép, chia sẻ lại hay bán lại nếu chủ hội không cho phép.',
          ],
        },
      ],
    },
    {
      id: 'dieu-cam',
      title: 'Những điều không được làm',
      blocks: [
        { type: 'p', text: 'Khi dùng Hội Mình, bạn không được:' },
        {
          type: 'list',
          items: [
            'Đăng hoặc bán nội dung trái pháp luật Việt Nam.',
            'Lừa đảo, hứa lợi nhuận chắc chắn, kêu gọi đầu tư rủi ro mà che giấu rủi ro, kinh doanh đa cấp trái phép, cờ bạc, hàng cấm.',
            'Quấy rối, xúc phạm, đe dọa hoặc kỳ thị người khác.',
            'Spam: nhắn tin, bình luận hay quảng cáo hàng loạt mà người nhận không yêu cầu.',
            'Đăng nội dung khiêu dâm, bạo lực, hoặc gây hại cho trẻ em.',
            'Vi phạm bản quyền, hoặc đăng thông tin riêng tư của người khác khi họ chưa đồng ý.',
            'Mạo danh người khác, chủ hội khác hoặc Hội Mình.',
            'Phá hoại hệ thống: dò mật khẩu, tấn công, cào dữ liệu hàng loạt, cố vượt giới hạn gọi API, hoặc giả mạo xác nhận thanh toán.',
            'Dùng Hội Mình để nhận tiền cho hoạt động trái phép.',
          ],
        },
      ],
    },
    {
      id: 'bao-cao-khoa',
      title: 'Báo cáo vi phạm và khóa tài khoản',
      blocks: [
        { type: 'h', text: 'Báo cáo và chặn' },
        {
          type: 'list',
          items: [
            'Để báo cáo một người: mở cuộc trò chuyện với người đó trong [Tin nhắn](/tin-nhan), bấm menu ba chấm, chọn Báo cáo rồi chọn lý do (spam, quấy rối, lừa đảo, nội dung không phù hợp, lý do khác). Báo cáo được gửi tới quản trị viên Hội Mình.',
            'Bạn cũng có thể chặn một người. Hai bên không nhắn tin được cho nhau cho tới khi bạn bỏ chặn.',
          ],
        },
        { type: 'h', text: 'Trong từng hội' },
        { type: 'p', text: 'Chủ hội và người điều hành có quyền duyệt hoặc xóa bài, mời một thành viên ra khỏi hội, hoặc chặn hẳn thành viên đó khỏi hội. Khi đó tư cách thành viên của bạn ở hội đó chấm dứt, còn lịch sử thanh toán vẫn được giữ.' },
        { type: 'h', text: 'Quyền của Hội Mình' },
        { type: 'p', text: 'Khi có vi phạm điều khoản này hoặc vi phạm pháp luật, quản trị viên Hội Mình có thể:' },
        {
          type: 'list',
          items: [
            'Tạm khóa một tài khoản. Tài khoản bị khóa không đăng nhập được.',
            'Khóa hoặc lưu trữ một hội. Hội bị khóa không còn hiện ở trang Khám phá.',
          ],
        },
        { type: 'p', text: 'Mức xử lý tùy mức độ vi phạm. Vi phạm nghiêm trọng như lừa đảo hay nội dung trái pháp luật có thể bị khóa ngay, không báo trước.' },
        { type: 'p', text: 'Hội bị khóa vì lỗi của chủ hội thì chủ hội vẫn chịu trách nhiệm với thành viên đã trả tiền, kể cả việc hoàn tiền.' },
        { type: 'p', text: 'Nếu bạn cho rằng mình bị khóa nhầm, hãy liên hệ Hội Mình để được xem lại.' },
      ],
    },
    {
      id: 'ben-khac',
      title: 'Dịch vụ của bên khác',
      blocks: [
        { type: 'p', text: 'Hội Mình chạy cùng một số dịch vụ của bên khác: ngân hàng và cổng thanh toán (MoMo, VNPAY, PayPal, Stripe), dịch vụ gửi email, và các nơi phát video, tài liệu mà chủ hội nhúng vào bài học (ví dụ YouTube, Google Drive).' },
        { type: 'p', text: 'Mỗi bên có điều khoản riêng mà bạn cần tuân theo khi dùng. Hội Mình không chịu trách nhiệm cho sự cố xảy ra ở phía họ, ví dụ ngân hàng báo có chậm, cổng thanh toán từ chối giao dịch, hay video bị nền tảng gốc gỡ.' },
      ],
    },
    {
      id: 'gioi-han',
      title: 'Giới hạn trách nhiệm',
      blocks: [
        { type: 'p', text: 'Hội Mình cố giữ dịch vụ chạy ổn định, nhưng không cam kết dịch vụ không bao giờ gián đoạn hay không có lỗi.' },
        { type: 'p', text: 'Hội Mình không chịu trách nhiệm về:' },
        {
          type: 'list',
          items: [
            'Chất lượng, độ chính xác của nội dung, khóa học và sản phẩm do chủ hội hoặc thành viên đưa lên.',
            'Giao dịch giữa thành viên và chủ hội, gồm cả khoản tiền chủ hội chưa hoàn và hoa hồng chủ hội chưa trả.',
            'Kết quả học tập, kinh doanh hay thu nhập mà bạn kỳ vọng từ một hội, một khóa học hay từ việc giới thiệu.',
          ],
        },
        { type: 'p', text: 'Trong phạm vi pháp luật cho phép, nếu Hội Mình phải bồi thường cho một chủ hội thì mức bồi thường không vượt quá số tiền gói chủ hội đó đã trả cho Hội Mình trong 12 tháng gần nhất.' },
        { type: 'p', text: 'Những giới hạn này không làm mất các quyền mà pháp luật về bảo vệ người tiêu dùng dành cho bạn.' },
      ],
    },
    {
      id: 'thay-doi',
      title: 'Thay đổi điều khoản và ngừng dùng',
      blocks: [
        { type: 'p', text: 'Hội Mình có thể sửa điều khoản khi sản phẩm thay đổi. Bản mới được đăng ở trang này và ghi rõ ngày cập nhật. Với thay đổi quan trọng, Hội Mình sẽ báo qua email hoặc thông báo trong ứng dụng.' },
        { type: 'p', text: 'Bạn ngừng dùng Hội Mình được bất cứ lúc nào. Hiện chưa có nút tự xóa tài khoản: muốn xóa, bạn gửi yêu cầu cho Hội Mình, xem phần Xóa tài khoản trong [Chính sách quyền riêng tư](/quyen-rieng-tu#xoa-tai-khoan).' },
      ],
    },
    {
      id: 'luat-ap-dung',
      title: 'Luật áp dụng và giải quyết tranh chấp',
      blocks: [
        { type: 'p', text: 'Điều khoản này được hiểu và áp dụng theo pháp luật Việt Nam, trong đó có các quy định về thương mại điện tử, bảo vệ quyền lợi người tiêu dùng và bảo vệ dữ liệu cá nhân.' },
        { type: 'p', text: 'Khi có tranh chấp, hai bên trao đổi và thương lượng với nhau trước. Nếu không thỏa thuận được, tranh chấp được đưa ra tòa án có thẩm quyền tại Việt Nam.' },
      ],
    },
    {
      id: 'lien-he',
      title: 'Liên hệ',
      blocks: [{ type: 'contact' }],
    },
  ],
};
