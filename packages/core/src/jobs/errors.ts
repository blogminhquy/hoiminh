// Phân loại lỗi của job: lỗi vĩnh viễn không bao giờ chạy lại được thì ack và bỏ, mọi lỗi khác coi là tạm thời và retry.

/** Payload sai, thực thể đã mất, trạng thái không còn hợp lệ: retry bao nhiêu lần cũng vậy. */
export class PermanentJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentJobError';
  }
}
