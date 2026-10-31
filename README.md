# PokéSurvivor Build Assistant 0.3.11

Extension Chrome/Edge Manifest V3 phát triển tiếp từ nền ổn định v0.3.2. Extension theo dõi lượt chơi, gợi ý thẻ theo Pokémon và skill đã học, tải move set tham khảo cho Partner, tự chọn thẻ, item và ghép Bond theo build. Tác giả: **Jokervtn94**.

## Cài đặt

1. Tải ZIP v0.3.11 và giải nén.
2. Mở `chrome://extensions` trên Chrome hoặc `edge://extensions` trên Edge.
3. Bật **Developer mode**.
4. Chọn **Load unpacked** và chọn thư mục có `manifest.json`.
5. Mở hoặc tải lại [pokesurvivor.com](https://pokesurvivor.com/).

Khi cài bản mới, nhấn **Reload** ở trang Extensions rồi tải lại tab game.

## Chức năng

- **Xếp hạng thẻ lên cấp:** tính điểm cho move theo Pokémon, hệ, hướng build, skill mục tiêu, tiến hóa và các skill đã học.
- **Tự chọn trong khoảng điểm gần nhau:** nếu hai lựa chọn dẫn đầu bằng điểm hoặc chênh không quá 6 điểm, extension chọn move sớm nhất trong thứ tự ưu tiên. Thứ tự này lấy từ move set Partner khi bật Auto build, sau đó đến các skill mục tiêu người chơi đã thêm. Nếu không có move ưu tiên trong nhóm điểm gần nhau, extension dùng thẻ được chấm hợp hướng build nhất.
- **Tự chọn thẻ dẫn điểm:** nếu lựa chọn đầu hơn lựa chọn tiếp theo trên 6 điểm và đạt trên 6 điểm, extension tự chọn thẻ đó sau 750 ms để chờ game mở khóa.
- **Tự reroll thẻ yếu:** mặc định bật cùng với tự chọn thẻ. Nếu thẻ có điểm cao nhất không vượt ngưỡng 6 điểm, hoặc đang bật Auto build nhưng cả ba thẻ đều không khớp move/thẻ chỉ số cần cho build Partner, extension bấm nút Reroll của game khi nút còn khả dụng rồi chấm lại bộ thẻ mới. Có thể tắt riêng tính năng này. Nếu game không còn lượt reroll, extension quay về quy tắc tự chọn hiện tại.
- **Gợi ý và tự chọn item:** xếp hạng hai item theo tác dụng, Partner, các move đã học hoặc move set đang theo và hướng build. Ưu tiên sát thương, hồi phục, giảm hồi chiêu, EXP, cơ động hoặc chống chịu theo tình huống; tự chọn item bật mặc định và có thể tắt riêng. Item lạ chưa nhận diện sẽ làm extension dừng click để tránh chọn đoán.
- **Chấm thẻ nâng cấp/thuộc tính:** Power, Vigor, Reflexes, Armor, Synthesis, Magnet, Sprint và các thẻ hiệu ứng được nhận diện sẽ có điểm nền theo hướng Cân bằng, Tiến hóa, Vật lý, Đặc biệt hoặc Sinh tồn. Thẻ không nhận diện được nhận điểm dự phòng; nếu cả ba lựa chọn đều không có dữ liệu, thứ tự game là tiêu chí cuối.
- **Gợi ý move set cho Partner:** tự tải khi nhận diện hoặc chọn Pokémon; có thể nhấn **Tải gợi ý** để thử lại. Extension hiển thị tối đa bốn move và thứ tự thẻ tiến hóa từ build tham khảo.
- **Nạp move mở màn của Partner:** khi thẻ lên cấp xuất hiện, extension đọc move mở màn đã chọn trong dữ liệu game lưu trên trình duyệt, bao gồm move thứ hai đã chọn nếu đã mở khóa. Nếu không đọc được bản lưu, extension dùng move mở màn mặc định theo Pokémon. Move được đánh dấu **Mở màn** và tham gia chấm điểm nâng cấp, gợi ý phối hợp và Bond.
- **Auto build theo move set:** bật **Tự build theo move set** để ưu tiên các move và thuộc tính trong lộ trình tham khảo khi game đưa thẻ lên cấp. Extension chỉ chọn trong những thẻ game đang đưa ra; không thể tạo thẻ hoặc tự học move không xuất hiện.
- **Theo dõi skill và Bond:** ghi nhận lựa chọn bằng click hoặc phím `1`–`3`, cho phép nhập move khởi đầu/cấp hiện tại, và gợi ý cặp Bond theo các move đã học.
- **Gợi ý Bond theo Partner:** hiển thị cặp ghép được hướng dẫn trong build cộng đồng; nếu trang không nêu cặp Bond, xếp cặp ưu tiên từ move set theo độ phối hợp và thứ tự move.
- **Tự chọn Bond:** bật riêng **Tự chọn Bond theo move set**. Khi hộp thoại Bond hiện ra, extension nhận diện cả prompt “Choose which move joins…” và “Which move do you bond … with?”, đồng thời dùng nút **Atrás** của game để xác nhận đã sang bước hai. Extension ưu tiên cặp được hướng dẫn, bấm move đầu rồi tự chọn move ghép. Nếu game chưa nhận click đầu, extension thử phím số tương ứng một lần; nếu vẫn không chuyển bước, extension báo để người chơi chọn thủ công.
- **Reset lượt:** khi Pokémon bị hạ và game hiện `#scr-over`, xóa skill, Bond, thẻ chỉ số và cấp độ của lượt; giữ lựa chọn Pokémon và hướng build.

## Cách dùng Auto build

1. Đồng bộ Partner hoặc chọn Pokémon trong bảng extension.
2. Chờ move set tải tự động; nếu chưa có, nhấn **Tải gợi ý**.
3. Khi lần đầu hiện thẻ lên cấp, kiểm tra move mở màn đã được nạp và đánh dấu **Mở màn** trong danh sách skill.
4. Bật **Tự build theo move set** và giữ **Tự chọn thẻ** bật.
5. Khi lên cấp, extension reroll nếu điểm cao nhất không quá 6 hoặc không có thẻ nào hỗ trợ lộ trình move set Partner. Khi hết lượt reroll, extension áp dụng quy tắc chọn theo điểm và thứ tự ưu tiên move.
6. Bật **Tự chọn Bond theo move set** riêng nếu muốn extension tự bấm hai move trong hộp thoại Bond.
7. Khi gặp hộp thoại item, extension tự xếp hạng rồi bấm item có điểm phù hợp cao nhất; tắt **Tự chọn item** nếu muốn tự quyết định.

Có thể thêm **Skill muốn nhắm tới** thủ công. Các skill được thêm trước sẽ có ưu tiên trước trong trường hợp gần điểm bằng nhau. Tắt **Tự build theo move set** nếu chỉ muốn xem gợi ý; tắt **Tự chọn thẻ** để không tự bấm.

## Nguồn và giới hạn

- Move/Pokémon game data lấy từ các trang tham chiếu công khai của [PokéSurvivor](https://pokesurvivor.com/en/).
- Mô tả và tác dụng item được đối chiếu với [danh sách held item của game](https://pokesurvivor.com/en/items/).
- Move set tham khảo lấy từ [PokéSurvivor Wiki Builds](https://pokesurvivors.org/builds/). Đây là wiki cộng đồng không chính thức; trang công bố một build mặc định cho mỗi Pokémon theo luật game, không phải xếp hạng lượt chọn phổ biến hay tỷ lệ thắng. Dữ liệu có thể thiếu hoặc đổi định dạng; khi đó extension vẫn hoạt động với gợi ý nội bộ.
- Một số trang build có thể ghi rõ một cặp move cần ghép. Extension đọc các hướng dẫn đó nếu có; nếu không, cặp Bond là gợi ý heuristic tính từ loại đòn, trạng thái, khả năng khống chế/hỗ trợ và thứ tự move set.
- Điểm là heuristic minh bạch, không đọc HP, đối thủ, thời tiết hoặc trạng thái ẩn trong game. Tên thẻ chưa có trong move catalog có thể chỉ được xếp theo loại hiệu ứng và hướng build.
- Điểm item là heuristic theo mô tả item công khai, trạng thái build extension đang biết và hướng build; extension không đọc HP hoặc trạng thái trận đấu ẩn để dự báo item nào chắc chắn tốt nhất.
- Move set và card priority là gợi ý; game có thể không đưa mọi move vào một lượt. Auto build không thay đổi trang bị hay Partner trong game.

## Quyền riêng tư

Extension lưu tùy chọn Pokémon, hướng build, move set đang dùng và dữ liệu tham khảo trong `chrome.storage.local`. Để đọc move mở màn, extension chỉ đọc các trường move của Partner hiện tại trong bản lưu game có sẵn trên pokesurvivor.com; dữ liệu này không được gửi ra ngoài. Để tải build Partner, tên Pokémon được dùng để mở đúng trang build công khai trên `pokesurvivors.org`. Extension không gửi dữ liệu lượt chơi lên dịch vụ này.

## Bản quyền

Mã nguồn extension được phát hành theo MIT License (xem [LICENSE](LICENSE)). Đây là dự án companion không chính thức, không liên kết với PokéSurvivor, Nintendo, GAME FREAK hoặc The Pokémon Company. Extension không đóng gói mã nguồn game, sprite hoặc nhạc.
