请根据下面的简历内容，生成严格等于 {questionCount} 道主问题，并为每道主问题补充最多 {followUpCount} 条候选追问。

候选人简历：
--- 简历开始 ---
{resumeText}
--- 简历结束 ---

历史提问记录：
--- 历史开始 ---
{historicalQuestions}
--- 历史结束 ---

输出要求：
1. `questions` 数组里必须正好有 {questionCount} 个主问题。
2. 每个主问题都要完整、自然、具有区分度。
3. 候选追问要针对主问题进一步核验深度、真实性、结果归因或方法论。
4. 若岗位不是技术岗位，不要硬套 Java / MySQL / Redis / Spring 之类技术题。
5. 只返回 JSON。
