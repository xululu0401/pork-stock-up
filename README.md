# 囤肉斤两

肉价低的时候，冻多少斤才不后悔。写下几种你觉得可能的价格走势和把握，拖动斤数看每种走势下省多少、亏多少；给出按把握最划算、最不后悔、亏得起三个斤数。

- 体验：https://xululu0401.github.io/pork-stock-up/
- 单页应用：`index.html` + `core.js`（计算）+ `ui.js`（界面），不联网，输入只存本机。
- 测试：`node --test tests/core.test.cjs`；`tests/ref.py` 是独立 Python 参考实现（Fraction 逐半斤模拟），生成 `tests/ref.json` 300 组对拍数据；`tests/inject.cjs` 是注入测试。
- 走势与把握是用户自己的判断，工具不预测肉价；默认数字为虚构示例。
