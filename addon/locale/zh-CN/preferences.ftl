pref-title = AI 标签
pref-description = 根据文献摘要和 PDF 内容自动生成标签

pref-section-api = API 配置
pref-active-llm-config = 当前 AI 配置
pref-active-llm-config-help = 可保存多套接口参数，切换后下方字段会自动同步
pref-add-llm-config = 复制配置
pref-delete-llm-config = 删除配置
pref-llm-config-name = 配置名称
pref-api-base-url = 接口地址
pref-api-key = API 密钥
pref-model = 模型
pref-api-extra-params = 高级参数（可选）
pref-api-extra-params-help = 以 JSON 格式填写，可直接参考下面示例
pref-api-extra-params-example = { "{" }"temperature": 0.7, "max_tokens": 2048{ "}" }
pref-test-api-connection = 测试连接

pref-section-rules = 标签规则
pref-max-tags = 最大标签数
pref-user-rules = 生成规则
pref-user-rules-help = 告诉 AI 你希望生成什么样的标签

pref-section-collection = 分类规则
pref-collection-rules-help = 为不同分类设置特殊规则
pref-collection-rule-collection = 选择分类
pref-collection-rule-add = 添加规则
pref-collection-rules-list = 已设置的规则
pref-collection-rules-list-help = 子分类会继承父分类的规则

pref-section-advanced = 高级选项
pref-max-concurrent-requests = 并发请求数
pref-requests-per-second = 每秒请求数
pref-preserve-existing-tags =
    .label = 保留已有标签
pref-fallback-attachment-text =
    .label = 首页提取失败时尝试全文
pref-enable-collection-routing =
    .label = 若输出的标签中包含 "@标签" 会将其自动移动到对应的"标签"分类
pref-debug =
    .label = 开启调试模式

pref-help = { $name } v{ $version } · 构建于 { $time }
