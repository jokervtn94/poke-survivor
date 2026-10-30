# PokéSurvivor Build Assistant 0.3.3

Extension Chrome/Edge Manifest V3 phát triển lại từ nền ổn định v0.3.2. Extension theo dõi lượt chơi, gợi ý thẻ theo Pokémon và skill đã học, tải move set tham khảo cho Partner và có thể tự chọn thẻ để đi theo move set. Tác giả: **Jokervtn94**.

## Cài đặt

1. Tải ZIP v0.3.3 và giải nén.
2. Mở `chrome://extensions` trên Chrome hoặc `edge://extensions` trên Edge.
3. Bật **Developer mode**.
4. Chọn **Load unpacked** và chọn thư mục có `manifest.json`.
5. Mở hoặc tải lại [pokesurvivor.com](https://pokesurvivor.com/).

## Chức năng

- **Xếp hạng thẻ lên cấp:** tính điểm cho move theo Pokémon, hệ, hướng build, skill mục tiêu, tiến hóa và các skill đã học.
- **Tự chọn trong khoảng điểm gần nhau:** nếu hai lựa chọn dẫn đầu bằng điểm hoặc chênh không quá 6 điểm, extension chọn move sớm nhất trong thứ tự ưu tiên. Thứ tự này lấy từ move set Partner khi bật Auto build, sau đó đến các skill mục tiêu người chơi đã thêm. Nếu không có move ưu tiên trong nhóm điểm gần nhau, extension dùng thẻ được chấm hợp hướng build nhất.
- **Tự chọn thẻ dẫn điểm:** nếu lựa chọn đầu hơn lựa chọn tiếp theo trên 6 điểm và đạt trên 6 điểm, extension tự chọn thẻ đó sau 750 ms để chờ game mở khóa.
- **Chấm thẻ nâng cấp/thuộc tính:** Power, Vigor, Reflexes, Armor, Synthesis, Magnet, Sprint và các thẻ hiệu ứng được nhận diện sẽ có điểm nền theo hướng Cân bằng, Tiến hóa, Vật lý, Đặc biệt hoặc Sinh tồn. Thẻ chưa nhận diện được xếp ở mức ưu tiên cuối theo hướng build và thứ tự xuất hiện.
- **Gợi ý move set cho Partner:** tự tải khi nhận diện hoặc chọn Pokémon; có thể nhấn **Tải gợi ý** để thử lại. Extension hiển thị tối đa bốn move và thứ tự thẻ tiến hóa từ build tham khảo.
- **Auto build theo move set:** bật **Tự build theo move set** để ưu tiên các move và thuộc tính trong lộ trình tham khảo khi game đưa thẻ lên cấp. Extension chỉ chọn trong những thẻ game đang đưa ra; không thể tạo thẻ hoặc tự học move không xuất hiện.
- **Theo dõi skill và Bond:** ghi nhận lựa chọn bằng click hoặc phím `1`–`3`, cho phép nhập move khởi đầu/cấp hiện tại, và gợi ý cặp Bond theo các move đã học.
- **Reset lượt:** khi Pokémon bị hạ và game hiện `#scr-over`, xóa skill, Bond, thẻ chỉ số và cấp độ của lượt; giữ lựa chọn Pokémon và hướng build.

## Cách dùng Auto build

1. Đồng bộ Partner hoặc chọn Pokémon trong bảng extension.
2. Chờ move set tải tự động; nếu chưa có, nhấn **Tải gợi ý**.
3. Bật **Tự build theo move set** và giữ **Tự chọn thẻ** bật.
4. Khi lên cấp, extension dùng điểm để chọn; nếu các lựa chọn gần nhau trong 6 điểm, nó ưu tiên move đầu tiên còn xuất hiện trong thứ tự move set.

Có thể thêm **Skill muốn nhắm tới** thủ công. Các skill được thêm trước sẽ có ưu tiên trước trong trường hợp gần điểm bằng nhau. Tắt **Tự build theo move set** nếu chỉ muốn xem gợi ý; tắt **Tự chọn thẻ** để không tự bấm.

## Nguồn và giới hạn

- Move/Pokémon game data lấy từ các trang tham chiếu công khai của [PokéSurvivor](https://pokesurvivor.com/en/).
- Move set tham khảo lấy từ [PokéSurvivor Wiki Builds](https://pokesurvivors.org/builds/). Đây là wiki cộng đồng không chính thức; trang công bố một build mặc định cho mỗi Pokémon theo luật game, không phải xếp hạng lượt chọn phổ biến hay tỷ lệ thắng. Dữ liệu có thể thiếu hoặc đổi định dạng; khi đó extension vẫn hoạt động với gợi ý nội bộ.
- Điểm là heuristic minh bạch, không đọc HP, đối thủ, thời tiết hoặc trạng thái ẩn trong game. Tên thẻ chưa có trong move catalog có thể chỉ được xếp theo loại hiệu ứng và hướng build.
- Move set và card priority là gợi ý; game có thể không đưa mọi move vào một lượt. Auto build không thay đổi trang bị hay Partner trong game.

## Quyền riêng tư

Extension lưu tùy chọn Pokémon, hướng build, move set đang dùng và dữ liệu tham khảo trong `chrome.storage.local`. Để tải build Partner, tên Pokémon được dùng để mở đúng trang build công khai trên `pokesurvivors.org`. Extension không gửi dữ liệu lượt chơi lên dịch vụ này.

## Bản quyền

Mã nguồn extension được phát hành theo MIT License (xem [LICENSE](LICENSE)). Đây là dự án companion không chính thức, không liên kết với PokéSurvivor, Nintendo, GAME FREAK hoặc The Pokémon Company. Extension không đóng gói mã nguồn game, sprite hoặc nhạc.
