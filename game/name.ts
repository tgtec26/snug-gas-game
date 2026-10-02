/** 대사 속 {name}을 학생이 입력한 이름으로, {count}를 숫자로 바꾼다. {name} 바로 뒤에는 조사를 붙이지 않는다(validators가 검사). */
export const withName = (text: string, name: string, count?: number): string =>
  text.replaceAll('{name}', name).replaceAll('{count}', String(count ?? ''));
