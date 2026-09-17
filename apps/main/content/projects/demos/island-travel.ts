// Fictional schedules and rules for this work only, not operational travel data.
export const cities = ["海口", "三亚", "琼海", "文昌", "儋州"] as const;
export const routeSeeds = [
  { origin: "海口", destination: "三亚", duration: 200, price: 128 },
  { origin: "三亚", destination: "海口", duration: 200, price: 128 },
  { origin: "海口", destination: "琼海", duration: 95, price: 68 },
  { origin: "琼海", destination: "海口", duration: 95, price: 68 },
  { origin: "海口", destination: "文昌", duration: 80, price: 52 },
  { origin: "海口", destination: "儋州", duration: 130, price: 86 },
] as const;
export const departures = [
  { time: "07:30", seats: 12, supplement: 0 },
  { time: "09:15", seats: 3, supplement: 10 },
  { time: "11:00", seats: 0, supplement: 0 },
  { time: "13:30", seats: 18, supplement: 10 },
  { time: "16:00", seats: 8, supplement: 20 },
  { time: "19:00", seats: 6, supplement: 20 },
] as const;
export const faqAnswers = {
  passenger: "这里使用系统提供的虚构乘车人。选择人数并核对行程后即可创建演示订单，无需填写真实姓名、手机号或证件号。",
  luggage: "本演示不处理行李额度和托运。实际出行请以承运方公布的规则为准。你可以继续体验班次选择和模拟购票。",
  arrival: "卡片中的发到站时间都是演示数据，不可用于真实出行。真实行程的到站、检票要求请向实际承运方确认。",
  payment: "所有支付都在本页面模拟，不会扣款。可以选择支付成功、失败、结果未知或出票异常；结果未知时先查单，出票异常时只重试出票。",
};
