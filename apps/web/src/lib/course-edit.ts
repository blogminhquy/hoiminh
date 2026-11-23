// Lối sửa nhanh bài học: từ trang học bài, người có quyền soạn khóa học bấm "Sửa bài học" để mở khung soạn khóa
// (/:slug/khoa-hoc/:courseId/soan) ở đúng bài đang xem. Bài được chọn truyền qua tham số ?bai=.

export const LESSON_PARAM = 'bai';

/** Đường dẫn mở khung soạn khóa học ở một bài cụ thể. */
export function lessonEditPath(slug: string, courseId: string, lessonId: string): string {
  return `/${slug}/khoa-hoc/${courseId}/soan?${LESSON_PARAM}=${encodeURIComponent(lessonId)}`;
}

interface ModuleWithLessons { id: string; lessons: Array<{ id: string }> }

/** Module chứa bài này (để khung soạn mở sẵn đúng module). Không thấy thì null. */
export function moduleOfLesson<M extends ModuleWithLessons>(modules: M[], lessonId: string | null | undefined): M | null {
  if (!lessonId) return null;
  return modules.find((m) => m.lessons.some((l) => l.id === lessonId)) ?? null;
}
