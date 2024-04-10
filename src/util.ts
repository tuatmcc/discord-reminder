import { format, parse } from "date-fns";

export function getApplicationId(token: string) {
    const [base64Id] = token.split('.');
    return atob(base64Id);
}

const fmt = "yyyy-MM-ddTHH:mm";

export function formatDateToString(date: Date) {
    return format(date, fmt);
}

export function parseStringToDate(str: string) {
    return parse(str, fmt, new Date());
}

export function checkValidStringAsDate(str: string){
    return parseStringToDate(str).toString() !== 'Invalid Date';
}