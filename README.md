# PokéSurvivor Build Assistant 0.3.2

Extension Chrome/Edge Manifest V3 hỗ trợ xếp hạng thẻ lên cấp theo Pokémon và các skill đã học, theo dõi build trong lượt chơi, gợi ý phối hợp Bond và tự chọn thẻ khi đạt điều kiện. Tác giả: **Jokervtn94**.

## Cài đặt

1. Tải ZIP v0.3.2 và giải nén.
2. Mở `chrome://extensions` trên Chrome hoặc `edge://extensions` trên Edge.
3. Bật **Developer mode**.
4. Chọn **Load unpacked** và chọn thư mục có `manifest.json`.
5. Mở hoặc tải lại [pokesurvivor.com](https://pokesurvivor.com/).

Sau khi cài, mở bảng **Build Assistant** trong game. Nếu Pokémon không được nhận diện, hãy tìm và chọn Pokémon thủ công trong bảng.

## Chức năng của v0.3.2

- **Gợi ý thẻ lên cấp:** đọc các thẻ trong màn hình chọn thưởng, xếp hạng theo Pokémon, hướng build và skill đã học; hiển thị tối đa ba gợi ý.
- **Tự chọn thẻ dẫn điểm:** bật sẵn. Extension chờ 750 ms để game mở khóa thẻ rồi tự bấm thẻ đứng đầu nếu thẻ đó đạt trên 6 điểm và dẫn điểm nghiêm ngặt so với thẻ kế tiếp. Nếu điểm hòa hoặc điều kiện chưa đạt, extension không tự chọn và người chơi có thể chọn thủ công.
- **Theo dõi skill trong lượt:** ghi nhận lựa chọn bằng click hoặc phím `1`–`3`. Có thể thêm skill khởi đầu/đã sở hữu cùng cấp hiện tại để tính điểm phối hợp chính xác hơn.
- **Đề xuất hướng build:** ưu tiên tiến hóa sẵn sàng, skill mục tiêu, thẻ chỉ số hỗ trợ công thức tiến hóa và các move bổ trợ cho skill đã học.
- **Gợi ý phối hợp Bond:** phân tích nhóm move đã ghi nhận để gợi ý cặp phối hợp; sau khi dùng Bond, có thể đánh dấu cặp đã ghép trong bảng.
- **Nhận diện Pokémon:** đọc tên Partner từ giao diện menu game; có thể tìm Pokémon thủ công nếu không nhận diện được.
- **Reset lượt khi Pokémon bị hạ:** khi game hiện màn hình kết thúc lượt (`#scr-over`), xóa skill, thẻ chỉ số và cấp độ của lượt đó, đồng thời giữ Pokémon, hướng build và skill mục tiêu.

## Cách dùng tự chọn thẻ

Giữ bật **Tự chọn thẻ dẫn điểm** trong bảng extension. Khi lên cấp, chờ bảng gợi ý hiện trạng thái đang xử lý. Extension chỉ tự bấm khi thẻ tốt nhất đạt **trên 6 điểm** và hơn điểm thẻ thứ hai. Điểm hòa, thẻ chưa đủ điểm hoặc game chưa mở khóa thẻ sẽ không kích hoạt tự chọn trong v0.3.2.

## Giới hạn

Điểm gợi ý là heuristic dựa trên dữ liệu Pokémon/move công khai và nội dung thẻ. Extension không đọc HP, đối thủ, thời tiết hoặc trạng thái ẩn của game. Nếu tên thẻ trong game không khớp dữ liệu move tiếng Anh, thẻ có thể được xếp hạng với độ tin cậy thấp. Game có thể thay đổi cấu trúc DOM và làm hỏng nhận diện thẻ.

v0.3.2 không có các chức năng tự kiểm tra/nhận thưởng Missions, Auto Gacha, quét Shop/PokeCoin/TM hoặc đề xuất và dạy TM cho Partner.

## Quyền riêng tư

Extension lưu tùy chọn Pokémon/hướng build và dữ liệu tham khảo công khai trong `chrome.storage.local`. Dữ liệu lượt chơi được xử lý trong trình duyệt để đề xuất thẻ. Extension chỉ chạy trên `pokesurvivor.com`.

## Tham chiếu

- https://pokesurvivor.com/en/guide/
- https://pokesurvivor.com/en/pokedex/
- https://pokesurvivor.com/en/moves/
- https://github.com/JPTER78/pokesurvivor

## Bản quyền

Mã nguồn extension được phát hành theo MIT License (xem [LICENSE](LICENSE)). Đây là dự án companion không chính thức, không liên kết với PokéSurvivor, Nintendo, GAME FREAK hoặc The Pokémon Company. Extension không đóng gói mã nguồn game, sprite hoặc nhạc.
