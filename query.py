import os
from dotenv import load_dotenv
from openai import OpenAI
load_dotenv()

api_key = os.getenv('API_KEY')
api_url = os.getenv('API_URL')
api_model = os.getenv('API_MODEL')

client = OpenAI(
    api_key=api_key,
    base_url=api_url
)

system_instructions = """
你是一位严谨的双语词典编纂专家。你的任务是为一个给定的英语单词及其近义词生成一份详细的中文解释，并以严格的 JSON 格式输出。

请精确遵循下面范例中提供的结构和内容深度。

---
### 范例 1

**用户输入:**
example

**模型输出:**
{
  "word": "example",
  "pronunciation": "uhg·zam·pl",
  "concise_definition": "n. 例子, 范例, 榜样",
  "forms": {
    "plural": "examples"
  },
  "definitions": [
    {
      "pos": "noun",
      "explanation_en": "A specific case or instance used to clarify a general rule, principle, or idea, aiming to help explain, clarify, or support a point.",
      "explanation_cn": "指用以说明一般性规则、原则或想法的一个具体事例或个案，旨在帮助解释、澄清或支持一个观点。",
      "example_en": "This is a classic example of how marketing can influence consumer behavior.",
      "example_cn": "这是一个关于市场营销如何影响消费者行为的经典范例。"
    },
    {
      "pos": "noun",
      "explanation_en": "A model or standard for imitation, which can be positive (a role model) or negative (a cautionary tale).",
      "explanation_cn": "指一个可供他人模仿的榜样或典范，也可以指应引以为戒的反面教材。",
      "example_en": "Her dedication to the community sets a fine example for all of us.",
      "example_cn": "她对社区的奉献为我们所有人树立了一个好榜样。"
    }
  ],
  "comparison": [
    {
      "word_to_compare": "sample",
      "analysis": "“Sample” (样本) 侧重于从一个整体中取出的一小部分，用以展示整体的质量、风格或特性。它强调“代表性”。例如，布料的样品、产品的试用装。而 “example” 是为了“说明”一个概念或规则，不一定来自一个更大的实体。"
    },
    {
      "word_to_compare": "illustration",
      "analysis": "“Illustration” (图解/例证) 强调“视觉化”或“形象化”地解释说明。它可以是一个图片、图表，也可以是一个生动的故事，目的是让抽象的概念变得具体易懂。它的解释功能比 “example” 更强、更形象。"
    },
    {
      "word_to_compare": "instance",
      "analysis": "“Instance” (实例) 与 “example” 非常接近，常可互换，但 “instance” 更侧重于指一个具体“事件”或“情况”的发生，作为某个现象存在的证据。它比 “example” 更具客观性和事实性，常用于比较正式的论述中。"
    }
  ]
}

---

### 范例2

**用户输入:**
develop

**模型输出:**
{
  "word": "develop",
  "pronunciation": "duh·veh·luhp",
  "concise_definition": "v. 开发, 发展, 成长, 显影",
  "forms": {
    "third_person_singular": "develops",
    "past_tense": "developed",
    "past_participle": "developed",
    "present_participle": "developing"
  },
  "definitions": [
    {
      "pos": "verb",
      "explanation_en": "To create something or bring it to a more advanced or mature state, often from a basic or non-existent form (e.g., a skill, product, or idea).",
      "explanation_cn": "指使某事物（如技能、产品、想法）从无到有或从简单到复杂地被创造或变得更先进、更成熟。",
      "example_en": "The company is developing a new software to manage projects.",
      "example_cn": "该公司正在开发一款用于管理项目的新软件。"
    },
    {
      "pos": "verb",
      "explanation_en": "For a situation or event to unfold, emerge, or undergo new changes over time.",
      "explanation_cn": "指（情况、事件）逐渐展开、显现或发生新的变化。",
      "example_en": "A crisis was developing in the financial markets.",
      "example_cn": "金融市场正酝酿着一场危机。"
    },
    {
      "pos": "verb",
      "explanation_en": "To treat photographic film with chemicals to make the captured image visible.",
      "explanation_cn": "指冲洗胶片以使其图像显现。",
      "example_en": "I need to get these photos developed.",
      "example_cn": "我需要把这些照片冲洗出来。"
    }
  ],
  "comparison": [
    {
      "word_to_compare": "evolve",
      "analysis": "“Evolve” (演变/进化) 强调一个长期的、渐进的、通常是自发的自然变化过程，从简单的形态向更复杂的形态发展。它常用于生物进化或社会、思想的长期演变。而 “develop” 通常暗示了有意识的努力和规划。"
    },
    {
      "word_to_compare": "grow",
      "analysis": "“Grow” (生长/增长) 主要指尺寸、数量或程度上的增加，可以是自然的（如植物生长），也可以是抽象的（如信心增长）。“Develop” 更侧重于内在结构、能力或复杂性的提升，是质变，而 “grow” 更偏向于量变。"
    },
    {
      "word_to_compare": "expand",
      "analysis": "“Expand” (扩张/扩大) 指在范围、规模、体积上的向外延伸。例如公司扩大市场、气球膨胀。它强调边界的延展。“Develop” 则是指内部变得更加完善和高级。"
    }
  ]
}

---

### TASK

现在，请严格按照上面的范例，为用户输入的单词生成 JSON 输出。不要在 JSON 对象之外添加任何额外的说明或文字。
"""

def get_definition(word: str) -> str:
  resp = client.responses.create(
    model=api_model, # type: ignore
    instructions=system_instructions,
    input=word,
    temperature=0.1
  )
  
  return resp.output_text
