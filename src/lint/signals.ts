export const prohibitionPattern = /禁止|不得|不能|不要|切勿|严禁|\b(?:never|must\s+not|do\s+not|don['’]t)\b/giu;
export const conditionPattern = /如果|若(?=遇到|出现|失败)|当.{0,24}时|特殊情况下|否则|\b(?:if|unless|otherwise|in\s+case)\b/giu;
export const rulePattern = /禁止|不得|不能|不要|务必|必须|应当|应该|需要|确保|请|\b(?:must|should|always|never|ensure|use|run|return|when)\b/iu;
export const signalPatterns: ReadonlyArray<readonly [string, RegExp]> = [
  ['prohibition', /禁止|不得|不能|不要|切勿|严禁|\b(?:never|must\s+not|do\s+not|don['’]t)\b/iu],
  ['emphasis', /务必|特别注意|再次强调|必须|\b(?:always|must|important)\b/iu],
  ['incident', /曾经发生|曾经|上次|历史事故|之前.{0,20}(?:错误|失败)|\b(?:previously|incident|last\s+time)\b/iu],
  ['exception', /如果遇到|特殊情况下|例外|\b(?:workaround|special\s+case|edge\s+case)\b/iu],
];
// Conservative routing signal only; it never proves the rule's semantics.
export const safetyPattern = /密钥|凭据|密码|隐私|授权|不可逆|删除|泄露|支付|\b(?:secret|credential|password|privacy|authorization|delete|payment|safety)\b/iu;
