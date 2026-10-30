# PokéSurvivor Build Assistant 0.3.9

Extension Chrome/Edge Manifest V3 hỗ trợ theo dõi lượt chơi, đề xuất build skill, đọc Partner/TM và quản lý một số thao tác trong game **[pokesurvivor.com](https://pokesurvivor.com/)**. Tác giả: **Jokervtn94**.

## Cài đặt

1. Tải ZIP phát hành và giải nén, hoặc tải mã nguồn repo này.
2. Mở `chrome://extensions` trên Chrome hoặc `edge://extensions` trên Edge.
3. Bật **Developer mode**.
4. Chọn **Load unpacked** và chọn thư mục có `manifest.json`.
5. Mở hoặc tải lại `https://pokesurvivor.com/`. Mở bảng **Build Assistant** ở góc trái.

Sau khi cập nhật mã nguồn, nhấn **Reload** ở trang Extensions rồi tải lại thẻ game.

## Chức năng và cách sử dụng

| Chức năng | Cách sử dụng | Extension xử lý |
|---|---|---|
| Nhận diện Pokémon Partner | Mở bảng khi đang ở menu game; nếu chưa đồng bộ, nhấn **Đồng bộ**. Có thể nhập tên Pokémon thủ công. | Đọc tên, hệ và độ hiếm Partner từ giao diện game; dùng lựa chọn thủ công khi không nhận diện được. |
| Chọn hướng build | Chọn **Cân bằng**, **Ưu tiên tiến hóa**, **Thiên vật lý**, **Thiên đặc biệt** hoặc **Sinh tồn**. Thêm skill muốn nhắm tới trong mục **Skill muốn nhắm tới**. | Dùng Pokémon, chiến lược và skill mục tiêu để xếp hạng thẻ lên cấp. |
| Gợi ý thẻ lên cấp | Đợi màn hình chọn thẻ xuất hiện. Bảng hiển thị tối đa ba gợi ý và lý do/điểm số; có thể chọn thẻ thủ công bằng chuột hoặc phím `1`–`3`. | Ưu tiên tiến hóa, skill mục tiêu, chỉ số cần thiết và skill phối hợp với các move đã học. |
| Tự chọn thẻ | Bật **Tự chọn thẻ điểm cao nhất**. Tùy chọn bật mặc định; có thể tắt nếu chỉ muốn xem gợi ý. | Tự bấm thẻ điểm cao nhất. Nếu hòa điểm hoặc move chưa có dữ liệu phân tích, ưu tiên theo thứ tự thẻ trên màn hình và vẫn tự chọn hạng 1. Không yêu cầu người chơi click thẻ. Chờ game mở khóa và tự thử lại nếu game chưa nhận lựa chọn. |
| Theo dõi skill trong lượt | Chọn thẻ trong game như bình thường; thêm move khởi đầu hoặc move đã có bằng ô **Ghi nhận move khởi đầu** và cấp skill hiện tại. | Ghi nhận lựa chọn bằng click/phím, tính phối hợp giữa các skill và gợi ý ghép Bond. Theo dõi tối đa 16 move qua 4 ô skill; sau khi ghép Bond, nhấn **Đánh dấu đã ghép** trên cặp tương ứng. |
| Reset sau khi Pokémon bị hạ | Không cần thao tác. | Khi nhận diện màn hình kết thúc lượt, xóa skill, chỉ số và cấp độ đã theo dõi; giữ Pokémon, chiến lược và skill mục tiêu cho lượt sau. Có thể dùng **Xóa lượt** để reset thủ công. |
| Kiểm tra và nhận thưởng Mission sau trận | Bật **Tự kiểm tra và nhận thưởng**. | Khi Pokémon bị hạ, tự về menu, mở Missions, nhận lần lượt các thưởng sẵn sàng rồi quay lại menu. Tắt nút để dừng tự nhận. |
| Auto Gacha sau trận | Bật **Tự quay khi kết thúc ván**, rồi chọn một hoặc nhiều chế độ: 10/100 lượt bằng vé thường hoặc vé ×10. | Sau Missions, dùng các chế độ đã bật khi nút quay còn đủ vé; xử lý màn kết quả rồi tiếp tục cho tới khi các chế độ hết vé và trở về menu. Có giới hạn an toàn 200 batch cho mỗi chế độ. |
| Build TM cho Partner | Nhấn **Tải build** hoặc chờ extension nhận diện Partner. Mở Túi trong game để đọc số TM đang sở hữu. | Đọc build tham khảo cho Partner hiện tại, xếp hạng tối đa ba TM tương thích và báo số lượng. **Sao chép build** chép danh sách; **Dạy TM tự động** mở Pokédex, bỏ qua move đã mở khóa, kiểm tra đủ TM còn thiếu rồi lần lượt dạy. Mỗi TM dạy mở khóa move vĩnh viễn cho Partner trong pool move của game. Không quét PokéCoin hay Shop. |

## Nguồn dữ liệu và giới hạn

- Build tham khảo lấy từ [PokéSurvivor Wiki](https://pokesurvivors.org/builds/), hiện có trang cho 966 Pokémon. Wiki ghi rõ build là đề xuất tạo theo quy tắc, không phải bảng xếp hạng tỷ lệ thắng; snapshot dữ liệu trên trang ghi ngày 2026-10-19.
- Tương thích TM tham khảo từ [TM Compatibility Checker](https://pokemonsurvivorwiki.com/tm-compatibility/) và snapshot dữ liệu game. Bảng được dùng để khóa nút dạy TM khi không xác nhận tương thích.
- [Hướng dẫn và bảng tính cộng đồng trên Steam](https://steamcommunity.com/sharedfiles/filedetails/?id=3819633059) là nguồn tham khảo bổ sung; nội dung có thể thay đổi theo phiên bản game.
- Điểm gợi ý là heuristic minh bạch, không đọc HP, đối thủ, thời tiết hoặc trạng thái ẩn. Gợi ý Bond là đánh giá phối hợp chiến thuật, không khẳng định đó là công thức ghép đặc biệt của game.
- Nếu tên move trong game chưa khớp danh mục tiếng Anh, extension có thể không xếp hạng được thẻ đó hoặc đánh giá với độ tin cậy thấp.

## Quyền riêng tư

Extension lưu tùy chọn build và dữ liệu tham khảo công khai trong `chrome.storage.local`. Tên Partner được dùng để tải trang build công khai; nội dung Túi TM chỉ được đọc trong trang game và lưu trong bộ nhớ cho tới khi đóng trang. Extension không đọc PokéCoin hoặc Shop.

## Bản 0.3.9

- Sửa nhận diện màn lên cấp khi game báo lớp bao ẩn nhưng các thẻ trong vùng cards đang hiển thị; tiếp tục gợi ý và tự chọn thẻ điểm cao nhất.

## Bản 0.3.8

- Chuyển nút và bảng Extension sang góc trái.
- Gỡ quét PokéCoin và Shop TM; chỉ đọc số lượng TM thụ động khi mở Túi.
- Sau trận, tự về menu, nhận Mission hoàn thành, chạy các chế độ Gacha đã bật và quay lại menu.
- Thêm bốn lựa chọn Auto Gacha: 10/100 lượt bằng vé thường hoặc vé ×10.
- Tải build theo Partner đang chơi, xếp hạng tối đa ba TM tương thích, sao chép danh sách và dạy TM tự động sau khi xác nhận đủ các TM còn thiếu trong Túi.
- Tiếp tục tự chọn thẻ lên cấp có điểm cao nhất và reset theo lượt.

### Giới hạn xếp hạng TM

Nguồn Builds tham khảo hiện cung cấp một bộ build cho mỗi Pokémon và không công bố số lượt đề xuất để xếp hạng ba bộ build riêng biệt. Extension vì vậy xếp tối đa ba TM ưu tiên trong bộ build đó theo hệ Pokémon, tương thích và heuristic build hiện có; không gắn nhãn đây là ba build phổ biến nhất.
## Tham chiếu

- https://pokesurvivor.com/en/guide/
- https://pokesurvivor.com/en/pokedex/
- https://pokesurvivor.com/en/moves/
- https://pokesurvivors.org/builds/
- https://pokemonsurvivorwiki.com/tm-compatibility/
- https://steamcommunity.com/sharedfiles/filedetails/?id=3819633059
- https://github.com/JPTER78/pokesurvivor

## Bản quyền

Mã nguồn extension được phát hành theo MIT License (xem [LICENSE](LICENSE)). Đây là dự án companion không chính thức, không liên kết với PokéSurvivor, Nintendo, GAME FREAK hoặc The Pokémon Company. Game và nội dung Pokémon thuộc quyền sở hữu của các chủ sở hữu tương ứng; extension không đóng gói mã nguồn game, sprite hoặc nhạc.
