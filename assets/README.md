# T计划图标

`tplan-icon-source.png` 使用内置 imagegen 工具，根据用户提供的 T计划 UI 板左上角图标生成。保留蓝色 T、右上双叶嫩芽、白色圆角底与浅冰蓝内层。生成结果已经目视检查；`tplan-icon-128.png` 和 `tplan.ico` 是通过 `desktop/convert-icon.ps1` 作尺寸/容器格式转换，ICO 含 16/32/48/64/128/256 六档。

界面直接嵌入 128px PNG 的 data URI，无远程素材加载。Windows EXE 使用同一图标资源。原始用户图片未修改。

生成提示词：

> Create ONE production-ready square desktop/mobile app icon for T计划 using the supplied poster as visual reference. Isolate and faithfully recreate ONLY the top-left app logo: a large bold simple capital T in vivid blue with a gentle blue gradient and subtle dimensional edge, and a small dark blue two-leaf sprout growing at its upper-right. Set inside a white, softly rounded square with a pale ice-blue inset and very soft tasteful shadow, matching the reference identity and proportions. Front-on view, crisp polished minimal UI app icon, centered, legible at 32px. Transparent background OUTSIDE the rounded white square. No Chinese text, no app name, no phone, no poster, no landscape, no extra lettering or decorative elements. Render a single square high-resolution icon suitable for PNG and Windows ICO; preserve the T + sprout visual identity from the reference.
