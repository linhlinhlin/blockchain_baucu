// S8 (spec 002): sanitize HTML do người dùng/admin nhập trước khi render qua
// dangerouslySetInnerHTML, chống stored XSS.
import DOMPurify from 'dompurify';

export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) {
    return '';
  }
  return DOMPurify.sanitize(dirty);
}
