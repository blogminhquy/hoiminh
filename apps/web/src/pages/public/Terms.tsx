// Điều khoản sử dụng (/dieu-khoan): trang công khai. Chữ nằm ở `legal/terms.ts`, khung dựng ở `legal/LegalDocument.tsx`.
import { LegalDocument } from './legal/LegalDocument';
import { TERMS } from './legal/terms';

export default function Page() {
  return <LegalDocument doc={TERMS} />;
}
