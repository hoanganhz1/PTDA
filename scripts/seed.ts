import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const products = [
  { name: "Bồn cầu compact Aster 2.0", category: "bồn cầu", brand: "TOTO", price: 4200000, original_price: 4800000, color: "Trắng", material: "Porcelain", dimensions_mm: { width: 360, depth: 620, height: 395 }, min_room_area_m2: 5, is_compact: true, features: ["nắp đóng êm", "tiết kiệm nước", "dễ vệ sinh"], warranty_months: 24, short_description: "Bồn cầu compact cho phòng tắm nhỏ, tiết kiệm không gian hiệu quả.", in_stock: true, image_placeholder_key: "toilet-compact" },
  { name: "Bồn cầu rimless Nano 3.0", category: "bồn cầu", brand: "INAX", price: 6200000, original_price: 7200000, color: "Trắng", material: "Gốm", dimensions_mm: { width: 370, depth: 650, height: 410 }, min_room_area_m2: 6, is_compact: true, features: ["tiết kiệm nước", "thiết kế rimless", "kháng bám bẩn"], warranty_months: 24, short_description: "Thiết kế hiện đại, bề mặt sạch sẽ và dễ lau chùi.", in_stock: true, image_placeholder_key: "toilet-rimless" },
  { name: "Bồn cầu wall-hung Nova 4.5", category: "bồn cầu", brand: "Grohe", price: 9100000, original_price: 10200000, color: "Trắng", material: "Porcelain", dimensions_mm: { width: 420, depth: 720, height: 400 }, min_room_area_m2: 8, is_compact: false, features: ["lắp âm tường", "nắp đóng êm", "màu trắng sang"], warranty_months: 36, short_description: "Dành cho không gian rộng hơn, phong cách tối giản.", in_stock: true, image_placeholder_key: "toilet-wall" },
  { name: "Bồn cầu 2 khối Vanta 3.2", category: "bồn cầu", brand: "TOTO", price: 5200000, original_price: 5800000, color: "Cát", material: "Gốm", dimensions_mm: { width: 400, depth: 650, height: 410 }, min_room_area_m2: 6, is_compact: true, features: ["nắp đóng êm", "bộ xả mạnh"], warranty_months: 24, short_description: "Phù hợp nhà ở gia đình, vận hành êm ái và bền bỉ.", in_stock: true, image_placeholder_key: "toilet-2piece" },
  { name: "Bồn cầu nhỏ Smart Mini", category: "bồn cầu", brand: "Kohler", price: 3900000, original_price: 4500000, color: "Trắng", material: "Ceramic", dimensions_mm: { width: 350, depth: 620, height: 390 }, min_room_area_m2: 4, is_compact: true, features: ["không gian nhỏ", "tiết kiệm nước", "dễ vệ sinh"], warranty_months: 18, short_description: "Lựa chọn tối ưu cho nhà vệ sinh mini.", in_stock: true, image_placeholder_key: "toilet-mini" },
  { name: "Bồn cầu tiểu nam Elite 6.8", category: "bồn cầu", brand: "TOTO", price: 6800000, original_price: 7800000, color: "Xám", material: "Gốm", dimensions_mm: { width: 410, depth: 760, height: 420 }, min_room_area_m2: 7, is_compact: false, features: ["rửa sạch hiệu quả", "không bám bẩn"], warranty_months: 24, short_description: "Bồn cầu tiện nghi cho công trình và gia đình.", in_stock: false, image_placeholder_key: "toilet-elite" },
  { name: "Lavabo rửa mặt Aura 60", category: "lavabo", brand: "TOTO", price: 4200000, original_price: 4800000, color: "Trắng", material: "Gốm", dimensions_mm: { width: 600, depth: 430, height: 220 }, min_room_area_m2: 5, is_compact: false, features: ["thiết kế hiện đại", "dễ lau chùi"], warranty_months: 24, short_description: "Lavabo trắng tinh tế cho phòng tắm hiện đại.", in_stock: true, image_placeholder_key: "lavabo-aura" },
  { name: "Lavabo góc Flex 50", category: "lavabo", brand: "INAX", price: 2800000, original_price: 3300000, color: "Be", material: "Gốm", dimensions_mm: { width: 500, depth: 430, height: 210 }, min_room_area_m2: 4, is_compact: true, features: ["tiết kiệm góc", "dễ lắp đặt"], warranty_months: 18, short_description: "Tối ưu cho phòng tắm nhỏ với góc làm việc hiệu quả.", in_stock: true, image_placeholder_key: "lavabo-corner" },
  { name: "Lavabo treo tường Luma 75", category: "lavabo", brand: "Grohe", price: 7400000, original_price: 8300000, color: "Trắng", material: "Gốm", dimensions_mm: { width: 750, depth: 440, height: 220 }, min_room_area_m2: 8, is_compact: false, features: ["treo tường", "thiết kế sang trọng"], warranty_months: 36, short_description: "Không gian rộng, giúp căn phòng trông gọn và cao cấp hơn.", in_stock: true, image_placeholder_key: "lavabo-wall" },
  { name: "Lavabo văn phòng Basic 55", category: "lavabo", brand: "Kohler", price: 2100000, original_price: 2600000, color: "Xám", material: "Composite", dimensions_mm: { width: 550, depth: 420, height: 210 }, min_room_area_m2: 4, is_compact: true, features: ["giá hợp lý", "dễ vệ sinh"], warranty_months: 12, short_description: "Lựa chọn kinh tế cho phòng vệ sinh gia đình.", in_stock: true, image_placeholder_key: "lavabo-basic" },
  { name: "Lavabo đá mài Venice 80", category: "lavabo", brand: "Villeroy & Boch", price: 12600000, original_price: 13800000, color: "Nâu", material: "Đá mài", dimensions_mm: { width: 800, depth: 450, height: 240 }, min_room_area_m2: 10, is_compact: false, features: ["bề mặt mịn", "thẩm mỹ cao"], warranty_months: 24, short_description: "Lavabo đá mài sang trọng, phù hợp vật liệu cao cấp.", in_stock: true, image_placeholder_key: "lavabo-stone" },
  { name: "Lavabo ngắn 45 Quill", category: "lavabo", brand: "INAX", price: 2400000, original_price: 2900000, color: "Trắng", material: "Gốm", dimensions_mm: { width: 450, depth: 390, height: 200 }, min_room_area_m2: 3, is_compact: true, features: ["phù hợp nhà vệ sinh nhỏ", "lắp đặt nhanh"], warranty_months: 18, short_description: "Lavabo nhỏ gọn, tối ưu cho bồn tắm mini.", in_stock: true, image_placeholder_key: "lavabo-short" },
  { name: "Sen cây MONA 1.0", category: "sen cây", brand: "Grohe", price: 2600000, original_price: 3300000, color: "Bạc", material: "Inox", dimensions_mm: { width: 220, depth: 220, height: 140 }, min_room_area_m2: 4, is_compact: true, features: ["chế độ mưa", "hạn chế văng bắn"], warranty_months: 24, short_description: "Sen cây hiện đại, chế độ xả mưa và tiết kiệm nước.", in_stock: true, image_placeholder_key: "shower-head" },
  { name: "Sen cây Orbit 2.0", category: "sen cây", brand: "TOTO", price: 3500000, original_price: 4200000, color: "Bạc", material: "Inox", dimensions_mm: { width: 240, depth: 230, height: 160 }, min_room_area_m2: 5, is_compact: false, features: ["công nghệ chạm", "điều khiển linh hoạt"], warranty_months: 24, short_description: "Sen cây tiện nghi với nhiều chế độ phun.", in_stock: true, image_placeholder_key: "shower-orbit" },
  { name: "Sen cây Classic Mini", category: "sen cây", brand: "Kohler", price: 1800000, original_price: 2200000, color: "Bạc", material: "Inox", dimensions_mm: { width: 180, depth: 180, height: 120 }, min_room_area_m2: 3, is_compact: true, features: ["giá mềm", "phù hợp nhỏ"], warranty_months: 12, short_description: "Sen cây tiết kiệm cho căn phòng nhỏ.", in_stock: true, image_placeholder_key: "shower-mini" },
  { name: "Sen cây cao cấp AquaJet", category: "sen cây", brand: "INAX", price: 7200000, original_price: 8200000, color: "Đen", material: "Inox", dimensions_mm: { width: 280, depth: 250, height: 170 }, min_room_area_m2: 7, is_compact: false, features: ["mưa lớn", "công nghệ chạm"], warranty_months: 36, short_description: "Tiêu thụ nước thấp nhưng xả mạnh, sang trọng.", in_stock: true, image_placeholder_key: "shower-aqua" },
  { name: "Sen cây duo Flex", category: "sen cây", brand: "Grohe", price: 4600000, original_price: 5200000, color: "Bạc", material: "Inox", dimensions_mm: { width: 260, depth: 220, height: 150 }, min_room_area_m2: 5, is_compact: false, features: ["phun tầng", "tiết kiệm nước"], warranty_months: 24, short_description: "Giải pháp phong cách cho phòng tắm hiện đại.", in_stock: false, image_placeholder_key: "shower-flex" },
  { name: "Sen cây Vortex 3.0", category: "sen cây", brand: "Villeroy & Boch", price: 9800000, original_price: 11000000, color: "Xám", material: "Inox", dimensions_mm: { width: 300, depth: 260, height: 190 }, min_room_area_m2: 9, is_compact: false, features: ["độ bền cao", "tiện nghi"], warranty_months: 24, short_description: "Sản phẩm premium cho không gian tắm cao cấp.", in_stock: true, image_placeholder_key: "shower-vortex" },
  { name: "Vòi lavabo Nova S", category: "vòi lavabo", brand: "Grohe", price: 2400000, original_price: 2900000, color: "Bạc", material: "Inox", dimensions_mm: { width: 140, depth: 140, height: 220 }, min_room_area_m2: 4, is_compact: true, features: ["điều khiển tốt", "hạn chế văng nước"], warranty_months: 24, short_description: "Vòi lavabo gọn, tiết kiệm nước và dễ vệ sinh.", in_stock: true, image_placeholder_key: "tap-nova" },
  { name: "Vòi lavabo slim L01", category: "vòi lavabo", brand: "TOTO", price: 1700000, original_price: 2100000, color: "Trắng", material: "Inox", dimensions_mm: { width: 120, depth: 120, height: 200 }, min_room_area_m2: 3, is_compact: true, features: ["mỏng", "thân thiện với mọi không gian"], warranty_months: 18, short_description: "Thiết kế nhỏ gọn cho phòng tắm mini.", in_stock: true, image_placeholder_key: "tap-slim" },
  { name: "Vòi lavabo AquaTouch", category: "vòi lavabo", brand: "Kohler", price: 3300000, original_price: 4200000, color: "Bạc", material: "Inox", dimensions_mm: { width: 150, depth: 150, height: 230 }, min_room_area_m2: 5, is_compact: false, features: ["công nghệ chạm", "nước mát"], warranty_months: 24, short_description: "Vòi lavabo công nghệ cao, cảm giác sử dụng mượt hơn.", in_stock: true, image_placeholder_key: "tap-touch" },
  { name: "Vòi lavabo Standart 30", category: "vòi lavabo", brand: "INAX", price: 1200000, original_price: 1600000, color: "Đen", material: "Inox", dimensions_mm: { width: 130, depth: 130, height: 210 }, min_room_area_m2: 3, is_compact: true, features: ["giá hợp lý", "độ bền cao"], warranty_months: 12, short_description: "Vòi lavabo đơn giản, phù hợp ngân sách.", in_stock: true, image_placeholder_key: "tap-standard" },
  { name: "Vòi lavabo Luxe M1", category: "vòi lavabo", brand: "Grohe", price: 5600000, original_price: 6200000, color: "Bạc", material: "Inox", dimensions_mm: { width: 160, depth: 160, height: 250 }, min_room_area_m2: 7, is_compact: false, features: ["mạnh mẽ", "sang trọng"], warranty_months: 36, short_description: "Sản phẩm cao cấp dành cho phòng tắm khang trang.", in_stock: true, image_placeholder_key: "tap-luxe" },
  { name: "Vòi lavabo smart flow", category: "vòi lavabo", brand: "Villeroy & Boch", price: 4900000, original_price: 5600000, color: "Bạc", material: "Inox", dimensions_mm: { width: 150, depth: 150, height: 240 }, min_room_area_m2: 6, is_compact: false, features: ["giảm tiêu hao nước", "thân thiện"], warranty_months: 24, short_description: "Thiết kế linh hoạt, phù hợp với mọi phong cách căn hộ.", in_stock: false, image_placeholder_key: "tap-flow" },
  { name: "Bồn tắm ngăn góc Alina", category: "bồn tắm", brand: "TOTO", price: 8900000, original_price: 9800000, color: "Trắng", material: "Gốm", dimensions_mm: { width: 1500, depth: 750, height: 700 }, min_room_area_m2: 12, is_compact: false, features: ["ngăn góc", "dễ vệ sinh", "điểm nhấn"], warranty_months: 36, short_description: "Bồn tắm góc để tối đa không gian, nội thất hiện đại.", in_stock: true, image_placeholder_key: "bath-corner" },
  { name: "Bồn tắm dài Sora 170", category: "bồn tắm", brand: "INAX", price: 11200000, original_price: 12600000, color: "Trắng", material: "Gốm", dimensions_mm: { width: 1700, depth: 700, height: 560 }, min_room_area_m2: 12, is_compact: false, features: ["dài thoải mái", "rộng rãi"], warranty_months: 36, short_description: "Dành cho phòng tắm rộng, cảm giác spa thư giãn.", in_stock: true, image_placeholder_key: "bath-long" },
  { name: "Bồn tắm compact Park 140", category: "bồn tắm", brand: "Kohler", price: 7200000, original_price: 8100000, color: "Trắng", material: "Gốm", dimensions_mm: { width: 1400, depth: 700, height: 520 }, min_room_area_m2: 8, is_compact: true, features: ["nhỏ gọn", "phù hợp căn hộ"], warranty_months: 24, short_description: "Bồn tắm compact dành cho căn hộ tối ưu không gian.", in_stock: true, image_placeholder_key: "bath-compact" },
  { name: "Bồn tắm nền City 150", category: "bồn tắm", brand: "Grohe", price: 14500000, original_price: 16000000, color: "Be", material: "Gốm", dimensions_mm: { width: 1500, depth: 760, height: 590 }, min_room_area_m2: 14, is_compact: false, features: ["sang trọng", "nền tắm chắc chắn"], warranty_months: 48, short_description: "Sản phẩm premium với kiểu dáng tối giản hiện đại.", in_stock: true, image_placeholder_key: "bath-floor" },
  { name: "Bồn tắm tắm sục Air 160", category: "bồn tắm", brand: "TOTO", price: 15600000, original_price: 17200000, color: "Trắng", material: "Composite", dimensions_mm: { width: 1600, depth: 800, height: 650 }, min_room_area_m2: 15, is_compact: false, features: ["tắm sục", "dễ vệ sinh"], warranty_months: 36, short_description: "Phong cách spa cho không gian phòng tắm rộng.", in_stock: false, image_placeholder_key: "bath-spa" },
  { name: "Bồn tắm mini 120", category: "bồn tắm", brand: "INAX", price: 6400000, original_price: 7300000, color: "Xám", material: "Gốm", dimensions_mm: { width: 1200, depth: 650, height: 500 }, min_room_area_m2: 7, is_compact: true, features: ["phù hợp căn nhỏ", "dễ vệ sinh"], warranty_months: 24, short_description: "Bồn tắm mini cho phòng tắm vừa và nhỏ.", in_stock: true, image_placeholder_key: "bath-mini" },
  { name: "Giá treo khăn Glassline", category: "phụ kiện phòng tắm", brand: "Grohe", price: 650000, original_price: 780000, color: "Bạc", material: "Thép", dimensions_mm: { width: 450, depth: 120, height: 500 }, min_room_area_m2: 2, is_compact: true, features: ["tiết kiệm diện tích", "sơn phủ chống gỉ"], warranty_months: 12, short_description: "Giá treo khăn hiện đại, gọn gàng cho phòng tắm.", in_stock: true, image_placeholder_key: "accessory-towel" },
  { name: "Kệ xoay góc Miu", category: "phụ kiện phòng tắm", brand: "Kohler", price: 940000, original_price: 1100000, color: "Trắng", material: "Composite", dimensions_mm: { width: 300, depth: 300, height: 700 }, min_room_area_m2: 2, is_compact: true, features: ["không gian góc", "dễ bố trí"], warranty_months: 12, short_description: "Kệ góc tiện dụng cho đồ dùng tắm.", in_stock: true, image_placeholder_key: "accessory-shelf" },
  { name: "Gương đèn hắt Rève", category: "phụ kiện phòng tắm", brand: "Villeroy & Boch", price: 2200000, original_price: 2600000, color: "Trắng", material: "Kính", dimensions_mm: { width: 600, depth: 120, height: 900 }, min_room_area_m2: 4, is_compact: false, features: ["đèn LED", "ánh sáng dịu"], warranty_months: 24, short_description: "Gương với đèn led, tạo không gian sáng hơn.", in_stock: true, image_placeholder_key: "accessory-mirror" },
  { name: "Nắp bồn cầu softclose", category: "phụ kiện phòng tắm", brand: "TOTO", price: 2800000, original_price: 3200000, color: "Trắng", material: "Gốm", dimensions_mm: { width: 360, depth: 260, height: 90 }, min_room_area_m2: 3, is_compact: true, features: ["nắp đóng êm", "bền bỉ"], warranty_months: 18, short_description: "Nắp bồn cầu giúp tăng độ kín và êm ái.", in_stock: true, image_placeholder_key: "accessory-seat" },
  { name: "Móc áo tắm Flora", category: "phụ kiện phòng tắm", brand: "INAX", price: 420000, original_price: 520000, color: "Bạc", material: "Thép", dimensions_mm: { width: 90, depth: 80, height: 200 }, min_room_area_m2: 2, is_compact: true, features: ["tiết kiệm diện tích", "đỡ nhẹ"], warranty_months: 12, short_description: "Móc áo tắm đa năng cho phòng tắm hiện đại.", in_stock: true, image_placeholder_key: "accessory-hook" },
  { name: "Kệ lọc dụng cụ Penta", category: "phụ kiện phòng tắm", brand: "Grohe", price: 730000, original_price: 890000, color: "Xám", material: "Composite", dimensions_mm: { width: 260, depth: 200, height: 500 }, min_room_area_m2: 2, is_compact: true, features: ["bền", "dùng trong nhà vệ sinh"], warranty_months: 12, short_description: "Kệ để dụng cụ vệ sinh, sắp xếp gọn gàng.", in_stock: true, image_placeholder_key: "accessory-organizer" },
  { name: "Thanh gắn tường đơn giản", category: "phụ kiện phòng tắm", brand: "Kohler", price: 320000, original_price: 400000, color: "Đen", material: "Thép", dimensions_mm: { width: 220, depth: 80, height: 300 }, min_room_area_m2: 2, is_compact: true, features: ["thiết kế tối giản"], warranty_months: 12, short_description: "Phụ kiện hỗ trợ treo khăn và đồ nhỏ.", in_stock: true, image_placeholder_key: "accessory-bar" },
  { name: "Ghế ngâm tắm Vibe", category: "phụ kiện phòng tắm", brand: "Villeroy & Boch", price: 1800000, original_price: 2100000, color: "Be", material: "Composite", dimensions_mm: { width: 500, depth: 500, height: 450 }, min_room_area_m2: 3, is_compact: false, features: ["thoải mái", "đáy chắc"], warranty_months: 18, short_description: "Ghế ngâm để tạo cảm giác thư giãn khi tắm.", in_stock: true, image_placeholder_key: "accessory-seat-bath" },
  { name: "Bồn tắm gắn tường Arc 160", category: "bồn tắm", brand: "Villeroy & Boch", price: 17500000, original_price: 18800000, color: "Trắng", material: "Gốm", dimensions_mm: { width: 1600, depth: 760, height: 610 }, min_room_area_m2: 16, is_compact: false, features: ["đẳng cấp", "thiết kế cao cấp"], warranty_months: 48, short_description: "Bồn tắm gắn tường, sang trọng, phù hợp phòng tắm rộng.", in_stock: true, image_placeholder_key: "bath-arc" },
  { name: "Bồn cầu cao cấp Prism 5.2", category: "bồn cầu", brand: "Grohe", price: 13800000, original_price: 15000000, color: "Đen", material: "Porcelain", dimensions_mm: { width: 450, depth: 760, height: 450 }, min_room_area_m2: 10, is_compact: false, features: ["rửa sạch", "nắp đóng êm"], warranty_months: 36, short_description: "Dành cho không gian sang trọng, dày dặn và an toàn.", in_stock: true, image_placeholder_key: "toilet-prism" },
  { name: "Lavabo xi măng vẻ cây 60", category: "lavabo", brand: "Kohler", price: 6800000, original_price: 7600000, color: "Xám", material: "Gốm", dimensions_mm: { width: 600, depth: 420, height: 220 }, min_room_area_m2: 8, is_compact: false, features: ["tối giản", "được ưa chuộng"], warranty_months: 24, short_description: "Lavabo xi măng hiện đại cho phòng tắm rộng.", in_stock: true, image_placeholder_key: "lavabo-mix" },
  { name: "Bồn cầu giá rẻ S1", category: "bồn cầu", brand: "INAX", price: 2200000, original_price: 2600000, color: "Trắng", material: "Gốm", dimensions_mm: { width: 350, depth: 610, height: 390 }, min_room_area_m2: 5, is_compact: true, features: ["giá hợp lý", "rửa sạch"], warranty_months: 12, short_description: "Lựa chọn tiền đầu tư thấp cho gia đình đã có nhu cầu căn bản.", in_stock: true, image_placeholder_key: "toilet-basic" },
  { name: "Vòi lavabo xả đơn flow", category: "vòi lavabo", brand: "TOTO", price: 990000, original_price: 1200000, color: "Bạc", material: "Inox", dimensions_mm: { width: 110, depth: 110, height: 190 }, min_room_area_m2: 3, is_compact: true, features: ["xả nhẹ", "dễ lắp"], warranty_months: 12, short_description: "Dễ lắp đặt, hoạt động bền và tiết kiệm.", in_stock: true, image_placeholder_key: "tap-flow2" },
  { name: "Kệ gương quay góc O2", category: "phụ kiện phòng tắm", brand: "TOTO", price: 540000, original_price: 640000, color: "Trắng", material: "Kính", dimensions_mm: { width: 300, depth: 120, height: 800 }, min_room_area_m2: 2, is_compact: true, features: ["gọn", "ngăn chứa đồ"], warranty_months: 12, short_description: "Phụ kiện tối giản và tiện dụng cho góc tắm.", in_stock: true, image_placeholder_key: "accessory-corner" },
  { name: "Bồn cầu vô cực 6.0", category: "bồn cầu", brand: "INAX", price: 18800000, original_price: 19500000, color: "Trắng", material: "Porcelain", dimensions_mm: { width: 480, depth: 760, height: 470 }, min_room_area_m2: 11, is_compact: false, features: ["thiết kế cao cấp", "vệ sinh tốt"], warranty_months: 36, short_description: "Mẫu cao cấp cho phòng tắm rộng và hiện đại.", in_stock: true, image_placeholder_key: "toilet-lux" },
  { name: "Vòi sen tắm đơn Brio", category: "sen cây", brand: "Grohe", price: 1450000, original_price: 1800000, color: "Bạc", material: "Inox", dimensions_mm: { width: 170, depth: 170, height: 130 }, min_room_area_m2: 3, is_compact: true, features: ["tiết kiệm nước", "phun mưa"], warranty_months: 12, short_description: "Sen tắm đơn giản và tối ưu cho căn hộ nhỏ.", in_stock: true, image_placeholder_key: "shower-brio" },
  { name: "Lavabo mini Coral 40", category: "lavabo", brand: "INAX", price: 1950000, original_price: 2400000, color: "Trắng", material: "Gốm", dimensions_mm: { width: 400, depth: 380, height: 200 }, min_room_area_m2: 3, is_compact: true, features: ["rộng vừa", "trong căn nhỏ"], warranty_months: 12, short_description: "Lavabo mini liền mạch cho phòng tắm nhỏ.", in_stock: true, image_placeholder_key: "lavabo-coral" }
];

const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "kidohomes.db");
const dataDir = path.dirname(dbPath);

fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    brand TEXT NOT NULL,
    price INTEGER NOT NULL,
    original_price INTEGER,
    color TEXT NOT NULL,
    material TEXT NOT NULL,
    dimensions_mm TEXT NOT NULL,
    min_room_area_m2 INTEGER NOT NULL,
    is_compact INTEGER NOT NULL,
    features TEXT NOT NULL,
    warranty_months INTEGER NOT NULL,
    short_description TEXT NOT NULL,
    in_stock INTEGER NOT NULL,
    image_placeholder_key TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS handoff_requests (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone_email TEXT NOT NULL,
    message TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'new'
  );

  CREATE TABLE IF NOT EXISTS chat_history (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const insert = db.prepare(`
  INSERT OR REPLACE INTO products (
    id, slug, sku, name, category, brand, price, original_price, color, material, dimensions_mm,
    min_room_area_m2, is_compact, features, warranty_months, short_description, in_stock,
    image_placeholder_key
  ) VALUES (
    @id, @slug, @sku, @name, @category, @brand, @price, @original_price, @color, @material, @dimensions_mm,
    @min_room_area_m2, @is_compact, @features, @warranty_months, @short_description, @in_stock,
    @image_placeholder_key
  )
`);

for (const [index, product] of products.entries()) {
  const id = `prod-${String(index + 1).padStart(3, "0")}`;
  const slug = product.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") + `-${index + 1}`;
  insert.run({
    ...product,
    id,
    slug,
    sku: `KDH-${String(index + 1).padStart(4, "0")}`,
    dimensions_mm: JSON.stringify(product.dimensions_mm),
    features: JSON.stringify(product.features),
    min_room_area_m2: product.min_room_area_m2,
    is_compact: product.is_compact ? 1 : 0,
    in_stock: product.in_stock ? 1 : 0,
  });
}

console.log(`Seeded ${products.length} products into ${dbPath}`);
