/**
 * Từ khóa chủ đề chính sách dùng chung cho:
 * - `lib/knowledge.ts` (truy xuất tài liệu)
 * - `lib/chat-rules.ts` (nhận diện câu hỏi chính sách ở chế độ offline)
 *
 * Tách riêng để hai nơi không lệch nhau, và để module thuần (không fs) test được.
 */

export type PolicyTopic = {
  file: string;
  label: string;
  keywords: string[];
};

export const POLICY_TOPICS: PolicyTopic[] = [
  {
    file: "policy-bao-hanh.md",
    label: "Bảo hành",
    keywords: [
      "bao hanh",
      "bao tri",
      "sua chua",
      "loi ky thuat",
      "het bao hanh",
      "doi moi",
      "serial",
      "phieu bao hanh",
      "hu hong",
    ],
  },
  {
    file: "policy-doi-tra.md",
    label: "Đổi trả",
    keywords: [
      "doi tra",
      "doi hang",
      "doi san pham",
      "tra hang",
      "tra lai",
      "hoan tien",
      "doi y",
      "giao sai",
      "thieu phu kien",
      "san pham bi loi",
      "san pham loi",
      "hu hong khi van chuyen",
      "giao hang bi hu",
      "giao hang bi vo",
      "nhan hang bi vo",
      "bi nut",
      "bi vo",
      "vo nut",
      "bi ran",
      "bi meo",
      "bi xuoc",
      "mo hop",
      "kiem hang",
      "dong kien",
      "phi doi tra",
      "48 gio",
      "7 ngay",
      "30 ngay",
    ],
  },
  {
    file: "policy-giao-hang.md",
    label: "Giao hàng",
    keywords: [
      "giao hang",
      "van chuyen",
      "phi van chuyen",
      "phi ship",
      "ship",
      "don hang",
      "nhan hang",
      "thoi gian giao",
      "giao may ngay",
      "may ngay",
      "khu vuc",
      "ha noi",
    ],
  },
  {
    file: "policy-lap-dat.md",
    label: "Lắp đặt",
    keywords: ["lap dat", "thi cong", "tho lap", "chi phi lap", "ky thuat vien", "dien nuoc"],
  },
  {
    file: "policy-lien-he.md",
    label: "Liên hệ",
    keywords: ["lien he", "hotline", "email", "goi dien", "nhan vien", "tu van vien", "dia chi", "showroom"],
  },
  {
    file: "policy-thanh-toan.md",
    label: "Thanh toán",
    keywords: ["thanh toan", "chuyen khoan", "hoa don", "dat coc", "coc", "tien mat", "hop dong", "bao gia"],
  },
];

/** Danh sách phẳng dùng cho việc nhận diện "câu này có phải hỏi chính sách không". */
export const policyKeywords = Array.from(new Set(POLICY_TOPICS.flatMap((topic) => topic.keywords)));
