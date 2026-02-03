import { System } from './types';

export const DB_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQhyG6Wkv36DnsJBQ1V2MqJFm9T7iguC0rYxKqc-jhNaDoN7Wweu9lo6KzES-l76YRFP2PQgMf7APIt/pub?gid=1128575640&single=true&output=csv";
export const UPLOAD_URL = "https://script.google.com/macros/s/AKfycbxyNPyjbVXDMTQxFPxEuuCDTNNf-iVFfqedfNbh-kgn6Tk9rSIFEfIaLWXxXZoNOVnWug/exec";

export const SYSTEMS: System[] = [
    {id: "GI", name: "🍽️ Gastro", full: "Gastro-intestinal system"},
    {id: "CVS", name: "🫀 Cardio", full: "Cardiovascular system"},
    {id: "Resp", name: "🫁 Resp", full: "Respiratory system"},
    {id: "CNS", name: "🧠 CNS", full: "Central nervous system"},
    {id: "Inf", name: "🦠 Infect", full: "Infections"},
    {id: "Endo", name: "🦋 Endo", full: "Endocrine system"},
    {id: "ObGyn", name: "🤰 ObGyn/GU", full: "Obstetrics, gynaecology, and urinary-tract disorders"},
    {id: "Malig", name: "🎗️ Onco", full: "Malignant disease and immunosuppression"},
    {id: "Nutri", name: "🩸 Blood/Nut", full: "Nutrition and blood"},
    {id: "MSK", name: "🦴 MSK", full: "Musculoskeletal and joint disease"},
    {id: "Eye", name: "👁️ Eye", full: "Eye"},
    {id: "ENT", name: "👂 ENT", full: "Ear, nose, and oropharynx"},
    {id: "Skin", name: "🧴 Skin", full: "Skin"},
    {id: "Immuno", name: "💉 Vaccine", full: "Immunological products and vaccines"},
    {id: "Anaes", name: "💤 Anaes", full: "Anaesthesia"},
];

export const DEFAULT_DEEPSEEK_KEY = "sk-92db3cf721454bd7b351ca6ef40eaaf7";
export const YINLI_URL = "https://yinli.one/v1/chat/completions";