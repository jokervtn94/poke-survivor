# PokéSurvivor Build Assistant 0.3.21

Extension Chrome/Edge Manifest V3 phát triển tiếp từ nền ổn định v0.3.2. Extension theo dõi lượt chơi, gợi ý thẻ theo Pokémon và skill đã học, cho phép tạo move set riêng từ danh sách move Partner có thể học, rồi tự chọn thẻ và ghép Bond theo cấu hình đã xác nhận. Build cộng đồng vẫn có thể tải riêng để tham khảo. Extension cũng tự chọn item và ghép Bond theo đúng thứ tự game cho phép. Một nhóm Bond có thể chứa tối đa bốn move. Tác giả: **Jokervtn94**.

## Cài đặt

1. Tải [ZIP v0.3.21](https://github.com/jokervtn94/poke-survivor/raw/refs/heads/main/releases/PokeSurvivor-Build-Assistant-v0.3.21.zip) và giải nén.
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
- **Gợi ý và tự chọn item:** xếp hạng item theo tác dụng, Partner, move set đã học/đang theo, hướng build và Bond. Bond đã ghép được dùng làm dữ liệu chính; nếu bật Auto Bond, lộ trình Bond dự kiến được tính với trọng số thấp hơn cho đến khi game xác nhận ghép. Điểm Choice Band tính theo số ô tấn công thực tế sau khi Bond gom nhiều move vào một ô; Quick Claw, Shell Bell, Life Orb và Leftovers được cộng điểm khi hiệu ứng hỗ trợ nhóm Bond. Build chưa có đòn gây sát thương không được cộng ưu tiên Choice Band. Tự chọn item bật mặc định và có thể tắt riêng; item lạ chưa nhận diện sẽ làm extension dừng click để tránh chọn đoán.
- **Chấm thẻ nâng cấp/thuộc tính:** Power, Vigor, Reflexes, Armor, Synthesis, Magnet, Sprint và các thẻ hiệu ứng được nhận diện sẽ có điểm nền theo hướng Cân bằng, Tiến hóa, Vật lý, Đặc biệt hoặc Sinh tồn. Thẻ không nhận diện được nhận điểm dự phòng; nếu cả ba lựa chọn đều không có dữ liệu, thứ tự game là tiêu chí cuối.
- **Gợi ý move set cho Partner:** tự tải khi nhận diện hoặc chọn Pokémon; có thể nhấn **Tải gợi ý** để thử lại. Extension hiển thị tối đa bốn move và thứ tự thẻ tiến hóa từ build tham khảo.
- **Tạo move set riêng cho Partner:** nhấn **Tự build move set** để mở màn hình biên tập riêng, không nằm trong bảng cuộn trợ lý chính. Màn hình có danh sách cuộn độc lập, tiêu đề Partner và thanh xác nhận luôn cố định bên dưới. Danh sách gồm move trong pool Normal và các hệ của Partner, cộng với move mở đầu đang chọn; mỗi hàng có biểu tượng theo hệ/kiểu tấn công, tên, hệ, loại và mô tả. Move mở đầu được chọn sẵn; thêm tối đa bốn move, sắp thứ tự bằng mũi tên và đánh dấu đúng hai move cho Bond đầu tiên. Có thể tạo build dù chưa tải được build cộng đồng.
- **Xác nhận tự build:** nhấn **Xác nhận & bật tự chọn + build + Bond** để lưu cấu hình theo Partner, bật tự chọn thẻ, Auto build và Auto Bond. Extension ưu tiên move theo thứ tự đã đặt, sau đó phát triển Bond theo cặp đầu tiên và thứ tự move còn lại.
- **Nạp move mở màn của Partner:** khi thẻ lên cấp xuất hiện, extension đọc move mở màn đã chọn trong dữ liệu game lưu trên trình duyệt, bao gồm move thứ hai đã chọn nếu đã mở khóa. Nếu không đọc được bản lưu, extension dùng move mở màn mặc định theo Pokémon. Move được đánh dấu **Mở màn** và tham gia chấm điểm nâng cấp, gợi ý phối hợp và Bond.
- **Auto build theo move set đã chọn:** sau khi xác nhận cấu hình, extension ưu tiên các move theo thứ tự người chơi đặt khi game đưa thẻ lên cấp. Cấu hình cũng chọn cặp Bond đầu tiên và thứ tự thêm move vào nhóm ở các Bond tiếp theo. Hai checkbox Auto build và Auto Bond vẫn cho phép tắt riêng từng chế độ. Extension chỉ chọn trong những thẻ game đang đưa ra; không thể tạo thẻ hoặc tự học move không xuất hiện.
- **Theo dõi skill và Bond:** ghi nhận lựa chọn bằng click hoặc phím `1`–`3`, cho phép nhập move khởi đầu/cấp hiện tại, và theo dõi các nhóm Bond tối đa bốn move.
- **Lộ trình Bond theo luật game:** lần ghép đầu tạo nhóm hai move. Nếu nhóm còn 2–3 move, Bond sau thêm đúng một move lẻ vào nhóm đó; khi không có nhóm dang dở, game ghép hai move lẻ để tạo nhóm mới. Vì vậy, nhóm bốn move được tạo theo chuỗi `2 → 3 → 4`, cần ba lần ghép, không phải hai cặp độc lập. Thứ tự move được xếp theo tương tác giữa sát thương, buff Physical/Special, trạng thái hỗ trợ Hex, khống chế, diện rộng và đòn đánh mục tiêu đơn.
- **Gợi ý ghép nhóm:** đọc danh tính các move trong thẻ Bond để nhận diện nhóm đã ghép; ưu tiên nhóm 2–3 move đang mở và move kế tiếp trong lộ trình Partner.
- **Tự chọn Bond:** bật riêng **Tự chọn Bond theo move set**. Ở lần đầu, extension chọn cặp ưu tiên; ở lần sau, đọc nhóm đang ghép từ câu hỏi, loại tên nhóm khỏi mô tả thẻ và chọn đúng một move lẻ. Extension thử các move còn lại trong build theo thứ tự; nếu game không đưa move ưu tiên ra, nó chấm các move hợp lệ đang hiển thị theo mức tương tác với nhóm và chọn phương án tốt nhất. Nếu chỉ có một move hợp lệ, extension chọn move đó. Game khóa thẻ trong 600 ms sau khi mở màn Bond; extension chờ lớp khóa của game được gỡ rồi click trực tiếp vào thẻ, không gửi phím tắt tổng hợp.
- **Reset lượt:** khi Pokémon bị hạ và game hiện `#scr-over`, xóa skill, Bond, thẻ chỉ số và cấp độ của lượt; giữ lựa chọn Pokémon và hướng build.

## Cách dùng Auto build

1. Đồng bộ Partner hoặc chọn Pokémon trong bảng extension.
2. (Tùy chọn) Nhấn **Tải gợi ý** để xem build cộng đồng; bước này không bắt buộc để tự tạo build.
3. Nhấn **Tự build move set** để mở màn hình riêng. Move mở đầu của Partner đã được chọn; thêm các move muốn build, điều chỉnh thứ tự ưu tiên và đánh dấu cặp Bond mở đầu.
4. Kiểm tra lựa chọn rồi nhấn **Xác nhận & bật tự chọn + build + Bond**. Cấu hình được lưu theo Pokémon Partner.
5. Khi lần đầu hiện thẻ lên cấp, kiểm tra move mở màn đã được nạp và đánh dấu **Mở màn** trong danh sách skill; giữ **Tự chọn thẻ** bật.
6. Khi lên cấp, extension reroll nếu thẻ yếu hoặc không hỗ trợ move set đã xác nhận, sau đó ưu tiên move theo thứ tự đã chọn.
7. Khi Bond xuất hiện, extension ưu tiên cặp mở đầu; các Bond tiếp theo phát triển nhóm theo thứ tự move. Nếu game không đưa move đó ra, extension chọn phương án hợp lệ tốt nhất trong các thẻ đang hiện.
8. Khi gặp hộp thoại item, extension tự xếp hạng rồi bấm item có điểm phù hợp cao nhất; tắt **Tự chọn item** nếu muốn tự quyết định.

Có thể thêm **Skill muốn nhắm tới** thủ công. Các skill được thêm trước sẽ có ưu tiên trước trong trường hợp gần điểm bằng nhau. Tắt **Tự build theo move set** nếu chỉ muốn xem gợi ý; tắt **Tự chọn thẻ** để không tự bấm.

## Nguồn và giới hạn

- Move/Pokémon game data lấy từ các trang tham chiếu công khai của [PokéSurvivor](https://pokesurvivor.com/en/). Danh sách move tự build lọc theo pool Normal và hệ của Partner, đồng thời giữ move mở đầu đang chọn; danh sách này không quét TM hoặc shop.
- Mô tả và tác dụng item được đối chiếu với [danh sách held item của game](https://pokesurvivor.com/en/items/).
- Move set tham khảo lấy từ [PokéSurvivor Wiki Builds](https://pokesurvivors.org/builds/). Đây là wiki cộng đồng không chính thức; trang công bố một build mặc định cho mỗi Pokémon theo luật game, không phải xếp hạng lượt chọn phổ biến hay tỷ lệ thắng. Dữ liệu có thể thiếu hoặc đổi định dạng; khi đó extension vẫn hoạt động với gợi ý nội bộ.
- Hướng dẫn chính thức cho biết mỗi lần hạ Legendary sẽ nhận một Bond để ghép hai move vào một ô; mã nguồn game đặt giới hạn một nhóm là bốn move. Game có bốn ô move. Vì vậy trần lý thuyết là 16 move trong bốn nhóm, tương đương 12 lần ghép nếu liên tục lấp lại các ô được giải phóng; đây là phép suy ra từ các giới hạn trên, không phải số Bond cố định được cấp mỗi lượt. Luật chọn tiếp được phản ánh trong extension: phát triển nhóm 2–3 move bằng cách thêm một move lẻ; nếu không có nhóm dang dở thì ghép hai move lẻ. Build tham khảo cho Partner chứa tối đa bốn move mục tiêu nên extension xếp một chuỗi ghép cho nhóm đó, không chia thành hai cặp. Các move trong nhóm cùng kích hoạt; thứ tự hiển thị chỉ là thứ tự game hỏi người chơi chọn.
- [Tin cập nhật game ngày 27-10-2026](https://pokesurvivor.com/en/news/) ghi nhận và sửa lỗi trên điện thoại khi bước chọn move thứ hai của Bond có thể nhận nhầm thẻ nằm dưới ngón tay. Vì vậy, extension đọc danh tính move trong từng thẻ, theo dõi prompt đổi bước và chỉ ghi nhận Bond sau khi hộp thoại đóng.
- Điểm là heuristic minh bạch, không đọc HP, đối thủ, thời tiết hoặc trạng thái ẩn trong game. Tên thẻ chưa có trong move catalog có thể chỉ được xếp theo loại hiệu ứng và hướng build.
- Điểm item là heuristic theo mô tả item công khai, trạng thái build extension đang biết và hướng build; extension không đọc HP hoặc trạng thái trận đấu ẩn để dự báo item nào chắc chắn tốt nhất.
- Move set và card priority là gợi ý; game có thể không đưa mọi move vào một lượt. Auto build không thay đổi trang bị hay Partner trong game.

## Quyền riêng tư

Extension lưu tùy chọn Pokémon, hướng build, move set đang dùng và dữ liệu tham khảo trong `chrome.storage.local`. Để đọc move mở màn, extension chỉ đọc các trường move của Partner hiện tại trong bản lưu game có sẵn trên pokesurvivor.com; dữ liệu này không được gửi ra ngoài. Để tải build Partner, tên Pokémon được dùng để mở đúng trang build công khai trên `pokesurvivors.org`. Extension không gửi dữ liệu lượt chơi lên dịch vụ này.

## Bản quyền

Mã nguồn extension được phát hành theo MIT License (xem [LICENSE](LICENSE)). Đây là dự án companion không chính thức, không liên kết với PokéSurvivor, Nintendo, GAME FREAK hoặc The Pokémon Company. Extension không đóng gói mã nguồn game, sprite hoặc nhạc.
