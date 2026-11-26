# QISU HUB V3.3 · The Living Archive

独立交互 Demo，基于 V3.2，不是 GitHub 正式项目的发行版；不改动正式仓库或真实数据。保留五中心、专家四入口、登录/授权演示、学术时间线与原始档案机制。所有账号及权限均为前端模拟，**不得部署成公网或多人正式服务，不要导入未公开的真实专家资料**。

## 启动（Mac / Windows / Linux）

1. 解压到同一目录。需要 Python 3.9+（建议 3.11+），没有额外 pip 依赖。
2. 在目录中运行 `python3 server.py`（Windows 可用 `py server.py`）。按提示输入 DeepSeek API Key（输入不回显）；或预先配置环境变量 `DEEPSEEK_API_KEY`。不设置密钥时仍能查看本地 Demo。
3. 打开 http://127.0.0.1:8765/ 。关闭服务：Ctrl+C。服务仅监听本机，不要端口转发。密钥只保存在服务进程内存/用户预设环境变量，不写入 HTML、浏览器、导出文件或日志。
4. 演示账号：admin / demo123；研究成员 researcher / demo123；专家初始邀请码 QISU-2026。若曾重置邀请码，在管理员权限中重新查看/重置。

直接双击 index.html 也可浏览与本地检索，但 DeepSeek 云能力必须通过本地 HTTP 服务访问。使用同一地址和浏览器配置，原 V3.2 的浏览器存储键保持兼容；不保证文件路径迁移或不同设备同步。

## 功能说明

- LLM：知识助理选择 DeepSeek 研究问答，先在当前身份允许访问的资料中关键词匹配最多 6 条摘录，核对传输授权，再提问。回答及引用需核实；不匹配时不请求模型。引用版本保留。不是向量 RAG，不等于完整学术事实核查。
- ASR：各搜索栏麦克风录制最多 30 秒，再将录音转换为 PCM WAV，发给 DeepSeek 识别；识别后填入文字，不自动提交。口述历史保留原始音频，在浏览器解码并转换为 16kHz 单声道 PCM WAV，每 90 秒一段，依次转写；段落索引由本地切分生成，不是逐字时间戳。失败后原件仍在，需重新发起转写；未做断点续传。长录音全文件解码可能占较多内存，格式兼容视浏览器而定，建议 WAV 或浏览器可解码音频。
- TTS：模型回答后点击朗读，选择海星/暗潮音色，合成并播放；Demo 限 6000 字。不是实时流式播放。
- OCR：管理员/研究成员在知识中心点击“文献识别 / OCR”，上传 PDF、Word、PPT 或图片（Demo 限 10 MiB）；文字/版面识别后，核对页码和文字，确认保存原件、原始逐页响应与可检索文字。输出不完整页会提示。原件下载在资产详情。此流程使用 OCR 逐页接口完成文献文字解析，不使用 Files API 云端文件引用/图像理解；Excel、电子书及图表语义解析未实现。
- Search / Fetch：知识助理“外部研究”独立入口，显式请求关键词/公开网页，显示摘要或正文及链接。管理员/研究成员可将其保存为待整理来源，人工编辑为已整理后才进入内部 AI 检索。不会自动联网或将专家资料发送为搜索词。
- 本地档案：原始音频和 OCR 原件用 IndexedDB，记录、版本和确认文本用 localStorage。通用 JSON 备份不含 IndexedDB 二进制原件；需单独下载录音与文献原件。浏览器清理数据会丢失本地存储；大批量档案可能受浏览器配额限制。生产版本应迁入真实后端和持久化对象存储。

所有向 DeepSeek 的请求可能计费，需要用户明确同意。云处理需要资料权利人授权，尤其是专家口述、个人资料及未公开史料。

## 官方协议（2026-11-26 核对）
- https://api-docs.deepseek.com/zh-cn/api/asr/
- https://api-docs.deepseek.com/zh-cn/api/tts/
- https://api-docs.deepseek.com/zh-cn/api/ocr/
- https://api-docs.deepseek.com/zh-cn/guides/search/
- https://api-docs.deepseek.com/zh-cn/guides/document_parsing/
- https://api-docs.deepseek.com/zh-cn/news/news261113/

## 验收与限制
- JavaScript 语法、Python 编译检查通过；16 项 Chromium 交互检查（内存页面、模拟网络、模拟浏览器存储），12 项本机 HTTP 代理及模拟 DeepSeek 上游协议检查通过。见 TEST-RESULTS.txt。
- 未提供 API Key，未对真实 DeepSeek 服务发出请求。未测试真实麦克风、真实长录音、真实多页 OCR、真实音频播放、字体精确加载及浏览器重载后原件持久化。
- 模拟权限不能提供真正安全隔离；未来移植原 React/FastAPI 项目时必须在后端重新实现授权检索、访问控制、上传限额、计费与审计。
