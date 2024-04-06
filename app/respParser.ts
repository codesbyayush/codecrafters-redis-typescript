let data: string[];

export function RESP2parser(passedData: string[], ind = 0) {
  console.log(passedData);
  data = passedData;
  let ans: any;
  return helper(ind)[0];
}

function handleArray(ind: number) {
  let ans: any = [];
  let length = Number(data[ind].substring(1));
  ind++;
  let further = 0;
  while (length > 0) {
    let temp = helper(ind);
    ans.push(temp[0]);
    ind += temp[1];
    length--;
    further += temp[1];
  }
  return [ans, further + 1];
}

function helper(ind: number) {
  if (data[ind][0] == "*") return handleArray(ind);
  switch (data[ind][0]) {
    case "+":
      return [handleSimpleString(data[ind]), 1];
    case "$":
      return [handleBulkString(data[ind + 1]), 2];
    case ":":
      return [handleInteger(data[ind]), 1];
    default:
      return [handleError(data[ind]), 1];
  }
}

function handleSimpleString(data: string) {
  return data.substring(1);
}

function handleInteger(data: string) {
  if (["+", "-"].includes(data[1])) return data.substring(2);
  return Number(data.substring(1));
}

function handleBulkString(data: string) {
  return data;
}

function handleError(data: string) {
  return data.substring(1);
}
