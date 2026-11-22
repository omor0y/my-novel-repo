#!/data/data/com.termux/files/usr/bin/bash
# Installs "fadaa" (فضاء الروايات → EPUB) in Termux.
#   pkg install -y curl && curl -fsSL https://raw.githubusercontent.com/omor0y/my-novel-repo/main/termux/install.sh | bash
# Run the same line again to update.
set -e
BASE="https://raw.githubusercontent.com/omor0y/my-novel-repo/main/termux"

echo "[1/4] Installing packages (python, pillow, ssh)..."
pkg update -y
pkg install -y python python-pillow openssh sshpass curl

echo "[2/4] Installing Python libraries..."
LIBS="requests beautifulsoup4 arabic-reshaper python-bidi<0.5"
pip install --upgrade $LIBS || pip install --upgrade --break-system-packages $LIBS

echo "[3/4] Downloading fadaa..."
mkdir -p "$HOME/fadaa" "$HOME/bin"
curl -fsSL "$BASE/fadaa.py" -o "$HOME/fadaa/fadaa.py"

cat > "$PREFIX/bin/fadaa" <<'EOF'
#!/data/data/com.termux/files/usr/bin/bash
exec python "$HOME/fadaa/fadaa.py" "$@"
EOF
chmod +x "$PREFIX/bin/fadaa"

# Sharing a link to Termux runs this script with the link.
cat > "$HOME/bin/termux-url-opener" <<'EOF'
#!/data/data/com.termux/files/usr/bin/bash
fadaa "$1"
echo
read -r -p "Press Enter to close " _
EOF
chmod +x "$HOME/bin/termux-url-opener"

echo "[4/4] Storage access..."
if [ ! -d "$HOME/storage/downloads" ]; then
  echo "Android will ask for storage permission: tap Allow."
  termux-setup-storage || true
fi

echo
echo "Done. Share a novel page from your browser to Termux,"
echo "or run:  fadaa https://cenele.com/cont/<novel>/"
echo "EPUB files go to: Download/Fadaa"
