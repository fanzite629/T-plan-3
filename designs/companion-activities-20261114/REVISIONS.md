# 后续修订与发布素材

## 学习与看书修订

### study

Use case: precise-object-edit / identity-preserve. Preserve the exact four already drawn character poses, faces, detailed orange hair, embroidered layered outfits, hands and props from Image 1. It is a 2x2 sprite sheet of FOUR frames, keep that exact layout and same-size cells. This is a cleanup pass, not a redesign. The top hair curl is too close to the edge. Shrink each complete character+desk+stool group within its own cell to 78 percent of cell height, with 11 percent clear space above and below and at least 8 percent on both sides. Reconstruct any tiny hair curl tip previously cut off, using the original identity reference Image 2. Make the spaces between cells genuinely transparent alpha. Remove all mist/glow/translucent coloured background residue. Keep the characters and desk fully opaque with crisp antialiased outlines. No new objects, labels or borders. Same four sequential small pen-writing poses.

### read

Use case: precise-object-edit / identity-preserve. Preserve the exact four already drawn character poses, faces, detailed orange hair, embroidered layered outfits, hands and props from Image 1. It is a 2x2 sprite sheet of FOUR frames, keep that exact layout and same-size cells. This is a cleanup pass, not a redesign. Remove ALL background clouds, haze and light halos. Only character, book and turning page should remain, opaque detailed subjects on true alpha transparency. Shrink each complete character within its own cell to 78 percent of cell height leaving about 11 percent clear transparent space above/below and at least 8 percent on each side. Keep the exact same four page-turning poses. No coloured smoke, no blurred light, no checkerboard baked into pixels, no new objects, labels or borders. Image 2 is the unchanged original identity reference.

采用 `generated/study.png`、`read.png` 和 `rest.png`。前两组使用留白/透明背景修订，初稿以 `-v1` 保留。发布资源位于 `../../v3-desktop/companion-assets/activity-{study,read,rest}-{00..03}.png`；`PrepareCompanionActivities.cs` 只切帧、清理透明杂点、统一缩放与地面锚点，不绘制人物。
