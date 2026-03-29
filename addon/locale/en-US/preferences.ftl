pref-title = AI Tags
pref-description = Auto-generate tags from abstracts and PDFs

pref-section-api = API Configuration
pref-active-llm-config = Current AI Config
pref-active-llm-config-help = Save multiple API setups and switch the fields below in one step
pref-add-llm-config = Duplicate Config
pref-delete-llm-config = Delete Config
pref-llm-config-name = Config Name
pref-api-base-url = API Endpoint
pref-api-key = API Key
pref-model = Model
pref-api-extra-params = Advanced Parameters (Optional)
pref-api-extra-params-help = Enter JSON and use the example below as a template
pref-api-extra-params-example = { "{" }"temperature": 0.7, "max_tokens": 2048{ "}" }
pref-test-api-connection = Test Connection

pref-section-rules = Tag Rules
pref-max-tags = Max Tags
pref-user-rules = Generation Rules
pref-user-rules-help = Tell the AI what kind of tags you want

pref-section-collection = Collection Rules
pref-collection-rules-help = Set special rules for different collections
pref-collection-rule-collection = Select Collection
pref-collection-rule-add = Add Rule
pref-collection-rules-list = Configured Rules
pref-collection-rules-list-help = Subcollections inherit rules from parent

pref-section-advanced = Advanced Options
pref-max-concurrent-requests = Concurrent Requests
pref-requests-per-second = Requests Per Second
pref-preserve-existing-tags =
    .label = Keep existing tags
pref-fallback-attachment-text =
    .label = Try full text if first page fails
pref-auto-generate-new-items =
    .label = Auto-generate tags for newly added items after metadata settles
pref-enable-collection-routing =
    .label = If output tags include "@tag", automatically move to corresponding "tag" collection
pref-debug =
    .label = Enable debug mode

pref-help = { $name } v{ $version } · Built { $time }
