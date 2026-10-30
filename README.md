# PokéSurvivor Build Assistant 0.3.6

Extension Chrome/Edge Manifest V3 hỗ trợ theo dõi lượt chơi, đề xuất build skill, đọc Partner/TM và quản lý một số thao tác trong game **[pokesurvivor.com](https://pokesurvivor.com/)**. Tác giả: **Jokervtn94**.

## Cài đặt

1. Tải ZIP phát hành và giải nén, hoặc tải mã nguồn repo này.
2. Mở `chrome://extensions` trên Chrome hoặc `edge://extensions` trên Edge.
3. Bật **Developer mode**.
4. Chọn **Load unpacked** và chọn thư mục có `manifest.json`.
5. Mở hoặc tải lại `https://pokesurvivor.com/`. Mở bảng **Build Assistant** ở góc phải.

Sau khi cập nhật mã nguồn, nhấn **Reload** ở trang Extensions rồi tải lại thẻ game.

## Chức năng và cách sử dụng

| Chức năng | Cách sử dụng | Extension xử lý |
|---|---|---|
| Nhận diện Pokémon Partner | Mở bảng khi đang ở menu game; nếu chưa đồng bộ, nhấn **Đồng bộ**. Có thể nhập tên Pokémon thủ công. | Đọc tên, hệ và độ hiếm Partner từ giao diện game; dùng lựa chọn thủ công khi không nhận diện được. |
| Chọn hướng build | Chọn **Cân bằng**, **Ưu tiên tiến hóa**, **Thiên vật lý**, **Thiên đặc biệt** hoặc **Sinh tồn**. Thêm skill muốn nhắm tới trong mục **Skill muốn nhắm tới**. | Dùng Pokémon, chiến lược và skill mục tiêu để xếp hạng thẻ lên cấp. |
| Gợi ý thẻ lên cấp | Đợi màn hình chọn thẻ xuất hiện. Bảng hiển thị tối đa ba gợi ý và lý do/điểm số; có thể chọn thẻ thủ công bằng chuột hoặc phím `1`–`3`. | Ưu tiên tiến hóa, skill mục tiêu, chỉ số cần thiết và skill phối hợp với các move đã học. |
| Tự chọn thẻ | Bật **Tự chọn thẻ dẫn điểm**. Tắt tùy chọn này bất cứ lúc nào để chỉ xem gợi ý. | Chỉ tự bấm khi thẻ đứng đầu đạt trên 6 điểm và hơn thẻ kế tiếp. Chờ 1,25 giây rồi thử lại mỗi 180 ms khi game còn khóa thẻ; nếu không đạt điều kiện thì để người chơi chọn. |
| Theo dõi skill trong lượt | Chọn thẻ trong game như bình thường; thêm move khởi đầu hoặc move đã có bằng ô **Ghi nhận move khởi đầu** và cấp skill hiện tại. | Ghi nhận lựa chọn bằng click/phím, tính phối hợp giữa các skill và gợi ý ghép Bond. Theo dõi tối đa 16 move qua 4 ô skill; sau khi ghép Bond, nhấn **Đánh dấu đã ghép** trên cặp tương ứng. |
| Reset sau khi Pokémon bị hạ | Không cần thao tác. | Khi nhận diện màn hình kết thúc lượt, xóa skill, chỉ số và cấp độ đã theo dõi; giữ Pokémon, chiến lược và skill mục tiêu cho lượt sau. Có thể dùng **Xóa lượt** để reset thủ công. |
| Kiểm tra và nhận thưởng nhiệm vụ | Ở menu game, mở mục **Nhiệm vụ** trong panel hoặc tự mở màn Missions. Tắt **Tự nhận thưởng nhiệm vụ hoàn thành** nếu muốn nhận thủ công. | Đếm nhiệm vụ đang làm/đã hoàn thành/đã nhận; tự bấm nhận trên nhiệm vụ sẵn sàng khi màn Missions đang mở. Extension không tự rời trận đang chơi để mở Missions. |
| Đọc PokéCoin và Shop TM | Sau lượt chơi, từ menu chính nhấn **Quét Shop** để mở Kecleon Shop và đọc giá; nhấn **Quét Túi TM** để đọc TM đang sở hữu. | Hiển thị số PokéCoin, offer TM, giá, khả năng học của Partner và số TM chưa dùng trong Túi. |
| So sánh TM với build | Dùng **Dùng Partner** hoặc nhập Pokémon ở mục **Đối chiếu build tham khảo**, rồi nhấn **So sánh**. Chọn một TM trong Túi để xem các Pokémon tương thích. | So sánh các move của build tham khảo với TM trong Túi và Shop; nêu TM còn thiếu hoặc Pokémon có thể dùng TM sẵn có. Mua TM và dạy move vẫn do người chơi xác nhận trong game. |

## Nguồn dữ liệu và giới hạn

- Build tham khảo lấy từ [PokéSurvivor Wiki](https://pokesurvivors.org/builds/), hiện có trang cho 966 Pokémon. Wiki ghi rõ build là đề xuất tạo theo quy tắc, không phải bảng xếp hạng tỷ lệ thắng; snapshot dữ liệu trên trang ghi ngày 2026-10-19.
- Tương thích TM tham khảo từ [TM Compatibility Checker](https://pokemonsurvivorwiki.com/tm-compatibility/) và snapshot dữ liệu game được rà soát đến 2026-10-22. Khả năng học TM hiển thị trực tiếp trong Shop được ưu tiên cho Partner hiện tại.
- [Hướng dẫn và bảng tính cộng đồng trên Steam](https://steamcommunity.com/sharedfiles/filedetails/?id=3819633059) là nguồn tham khảo bổ sung; nội dung có thể thay đổi theo phiên bản game.
- Điểm gợi ý là heuristic minh bạch, không đọc HP, đối thủ, thời tiết hoặc trạng thái ẩn. Gợi ý Bond là đánh giá phối hợp chiến thuật, không khẳng định đó là công thức ghép đặc biệt của game.
- Nếu tên move trong game chưa khớp danh mục tiếng Anh, extension có thể không xếp hạng được thẻ đó hoặc đánh giá với độ tin cậy thấp.

## Quyền riêng tư

Extension lưu tùy chọn build và dữ liệu tham khảo công khai trong `chrome.storage.local`. Chỉ slug Pokémon được chọn được gửi tới trang build tham khảo để tải dữ liệu công khai. Thông tin tài khoản game, số coin và nội dung Túi TM không được gửi ra ngoài; danh sách TM quét được chỉ giữ trong bộ nhớ trang cho tới khi đóng trang.

## Bản 0.3.6

- Chờ giao diện game xuất hiện nếu trang tải chậm.
- Gắn lại observer khi Shop hoặc lượt chơi mới thay node giao diện; đồng bộ lại trạng thái khi quay lại tab.
- Dùng listener click cấp trang và truy vấn lại `#cards` hiện tại để tránh giữ tham chiếu node cũ.
- Chờ khóa thẻ lên cấp hết hạn và thử lại tự chọn trong thời gian giới hạn.

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
