// Chính sách quyền riêng tư (/quyen-rieng-tu): trang công khai. Chữ nằm ở `legal/privacy.ts`, khung dựng ở `legal/LegalDocument.tsx`.
import { LegalDocument } from './legal/LegalDocument';
import { PRIVACY } from './legal/privacy';

export default function Page() {
  return <LegalDocument doc={PRIVACY} />;
}
