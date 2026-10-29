# 第三方组件说明

本项目在运行时使用了以下开源组件，按各自的许可证分发：

| 组件 | 许可证 | 说明 |
| --- | --- | --- |
| [React](https://react.dev/) | MIT | 界面框架 |
| [Vite](https://vite.dev/) | MIT | 构建工具 |
| [tesseract.js](https://github.com/naptha/tesseract.js) | Apache-2.0 | 浏览器端 OCR 引擎，`public/tesseract/` 与 `public/tesseract-core/` 中的文件来自其发行包 |
| [tesseract.js-core](https://github.com/naptha/tesseract.js-core) | Apache-2.0 | Tesseract WASM 编译产物 |
| [Tesseract tessdata_best](https://github.com/tesseract-ocr/tessdata_best) | Apache-2.0 | 中文 / 英文语言模型，`public/tessdata/` 中的 `.traineddata.gz` |

`public/` 下的 OCR 资源均为原样复制，未作修改。相关许可证全文可在各项目主页获取。
