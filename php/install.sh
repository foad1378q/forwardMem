#!/usr/bin/env bash
# ==============================================================================
# Telegram Forwarder Management Script (install.sh)
# الگوبرداری‌شده از اسکریپت تعاملی مدیریت سرور سبک Faoxima
# ==============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

clear
echo -e "${CYAN}==================================================================${NC}"
echo -e "${GREEN}   ⚡ سامانه مدیریت و فوروارد هوشمند تلگرام (نسخه PHP)            ${NC}"
echo -e "${CYAN}==================================================================${NC}"
echo -e " 1) 🚀 نصب پیش‌نیازهای سیستم و PHP"
echo -e " 2) 🤖 راه‌اندازی و ورود به اکانت تلگرام (Login MadelineProto)"
echo -e " 3) 🔄 استارت / راه‌اندازی مجدد سرویس Worker (Systemd)"
echo -e " 4) ⏹️ متوقف‌سازی سرویس Worker"
echo -e " 5) 📑 مشاهده لاگ‌های زنده Worker"
echo -e " 6) 💾 اجرای دستی بکاپ دیتابیس و ارسال به تلگرام"
echo -e " 0) ❌ خروج"
echo -e "${CYAN}------------------------------------------------------------------${NC}"
read -p "لطفاً شماره گزینه مورد نظر را وارد کنید: " choice

case $choice in
    1)
        echo -e "\n${YELLOW}[*] در حال نصب پیش‌نیازها (PHP 8.2, Extensions, Composer)...${NC}"
        apt-get update
        apt-get install -y php8.2-cli php8.2-mysql php8.2-curl php8.2-mbstring php8.2-xml php8.2-zip php8.2-gmp unzip curl
        echo -e "${GREEN}[✓] پیش‌نیازها با موفقیت نصب شدند.${NC}"
        ;;

    2)
        echo -e "\n${YELLOW}[*] در حال اجرای اسکریپت ورکر جهت لاگین و دریافت کد پیامکی تلگرام...${NC}"
        php worker.php
        ;;

    3)
        echo -e "\n${YELLOW}[*] در حال پیکربندی و فعال‌سازی سرویس systemd...${NC}"
        CURRENT_DIR=$(pwd)
        sed -i "s|/var/www/telegram-forwarder|${CURRENT_DIR}|g" systemd/telegram-worker.service
        cp systemd/telegram-worker.service /etc/systemd/system/telegram-worker.service
        systemctl daemon-reload
        systemctl enable telegram-worker
        systemctl restart telegram-worker
        echo -e "${GREEN}[✓] سرویس Worker با موفقیت استارت شد و در پس‌زمینه در حال اجراست.${NC}"
        systemctl status telegram-worker --no-pager
        ;;

    4)
        echo -e "\n${YELLOW}[*] متوقف‌سازی سرویس...${NC}"
        systemctl stop telegram-worker
        echo -e "${RED}[✓] سرویس Worker متوقف شد.${NC}"
        ;;

    5)
        echo -e "\n${CYAN}[*] نمایش لاگ زنده (برای خروج Ctrl+C بزنید):${NC}"
        journalctl -u telegram-worker -f
        ;;

    6)
        echo -e "\n${YELLOW}[*] در حال تهیه نسخه پشتیبان...${NC}"
        php cron/backup.php
        ;;

    0)
        echo "خروج."
        exit 0
        ;;

    *)
        echo -e "${RED}گزینه نامعتبر است.${NC}"
        ;;
esac
