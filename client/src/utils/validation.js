export function validateCharNum(value) {
  return value.replace(/[\\!"$%^&+*_={};:'@#~,()\-/<>?|`[\]]/g, '');
}
