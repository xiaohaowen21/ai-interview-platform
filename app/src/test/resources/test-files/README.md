# 测试文件说明

本目录包含用于测试文档解析服务的样例文件。

## 文件列表

### 1. sample-resume.txt
- **格式**: 纯文本（TXT）
- **编码**: UTF-8
- **内容**: 完整的中文简历，包含基本信息、教育背景、工作经验、项目经验等
- **特点**: 包含分隔线、列表、多段落结构
- **用途**: 测试基本文本文件解析功能

### 2. sample-resume.md
- **格式**: Markdown
- **编码**: UTF-8
- **内容**: 全栈工程师简历，使用 Markdown 语法格式化
- **特点**: 
  - 包含 Markdown 标题、列表、粗体、链接等语法
  - 使用 Emoji 图标
  - 结构化程度高
- **用途**: 测试 Markdown 文件解析和格式处理

## 测试场景覆盖

这些测试文件覆盖以下场景：

### 内容类型
- ✅ 中文文本
- ✅ 英文字符
- ✅ 数字和日期
- ✅ 特殊符号（邮箱、电话、URL）
- ✅ Emoji 表情
- ✅ Markdown 语法

### 结构特征
- ✅ 标题和分隔线
- ✅ 有序和无序列表
- ✅ 多层级段落
- ✅ 空行和缩进
- ✅ 长文本和短文本混合

### 边界情况
- ✅ 特殊字符处理
- ✅ URL 和超链接
- ✅ 换行符处理
- ✅ 空格和制表符

## 使用建议

### 单元测试
在单元测试中使用这些文件：

```java
@Test
void testParseSampleResume() throws Exception {
    // 读取测试文件
    Path testFile = Paths.get("src/test/resources/test-files/sample-resume.txt");
    byte[] content = Files.readAllBytes(testFile);
    
    // 创建 MultipartFile
    MockMultipartFile file = new MockMultipartFile(
        "file",
        "sample-resume.txt",
        "text/plain",
        content
    );
    
    // 解析并验证
    String result = documentParseService.parseContent(file);
    assertNotNull(result);
    assertTrue(result.contains("张三"));
}
```

### 集成测试
用于验证整个文档处理流程：

1. 上传文件
2. 解析内容
3. 清理文本
4. 存储和检索

## 添加新的测试文件

如需添加新的测试文件，请遵循以下规范：

1. **命名规范**: `sample-{类型}-{特点}.{扩展名}`
   - 例如: `sample-resume-english.txt`
   - 例如: `sample-knowledge-technical.pdf`

2. **编码**: 统一使用 UTF-8

3. **文档化**: 在本 README 中添加说明

4. **大小限制**: 单个测试文件不超过 1MB

## 注意事项

- 测试文件中的个人信息均为虚构，仅用于测试
- 不要在测试文件中使用真实的个人信息
- 测试文件应该具有代表性，覆盖常见场景
- 定期检查和更新测试文件，保持与实际使用场景一致
