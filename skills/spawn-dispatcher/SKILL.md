---
name: spawn-dispatcher
description: "手动触发时 spawn dispatcher agent。触发方式：用户说「spawn dispatcher」。"
metadata:
  { "openclaw": { "emoji": "🎯" } }
---

# Spawn Dispatcher Skill

手动触发时，spawn dispatcher agent。

## 触发条件

用户说「spawn dispatcher」或类似指令。

**触发即执行。无判断。**

## 执行动作

```
sessions_spawn(agentId: "dispatcher", task: "用户请求：[原始请求内容]")
```

等待 dispatcher 返回结果，然后转给用户。