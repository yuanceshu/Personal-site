# 实验服务协作规则

遵循 MyProducts 根规则和 docs/06_实验作品组织与接入规划.md。
当前实现 ai-solution-lab 和 island-travel：FastAPI/Pydantic、显式模型客户端，无 Agno、业务数据库或账号。岛见只提供意图理解，交易在浏览器模拟；公网限流在主站代理执行，详见 docs/projects/island-travel.md。
接口权威为作品 schemas.py；语义检查在 domain.py。前端 Zod 与共享正反例对照验证。
密钥仅服务端环境变量；不读取静眠森资料和配置，不记录请求正文及模型完整响应。
不新增通用业务平台。修改后 uv run pytest、uv lock --check；数据契约变化同步前端测试。
