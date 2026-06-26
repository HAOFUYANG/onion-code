import stringWidth from "string-width";

/**
 * 终端输入缓冲区，管理文本和光标位置。
 * 使用 string-width 正确处理 CJK 等全角字符的列宽。
 */
export class InputBuffer {
  private chars: string[] = [];
  /** 光标在 chars 数组中的索引位置 */
  private cursorIndex = 0;

  /** 获取当前文本 */
  get text(): string {
    return this.chars.join("");
  }

  /** 计算从位置 0 到指定索引的可见列宽 */
  private calcColumnWidth(toIndex: number): number {
    if (toIndex <= 0) return 0;
    const slice = this.chars.slice(0, toIndex).join("");
    return stringWidth(slice);
  }

  /** 获取当前光标的可见列位置 */
  getCursorColumn(): number {
    return this.calcColumnWidth(this.cursorIndex);
  }

  /** 在光标位置插入文本 */
  insert(str: string): void {
    const chars = [...str];
    this.chars.splice(this.cursorIndex, 0, ...chars);
    this.cursorIndex += chars.length;
  }

  /** 删除光标前一个字符 */
  backspace(): void {
    if (this.cursorIndex <= 0) return;
    this.cursorIndex--;
    this.chars.splice(this.cursorIndex, 1);
  }

  /** 删除光标后一个字符 */
  deleteForward(): void {
    if (this.cursorIndex >= this.chars.length) return;
    this.chars.splice(this.cursorIndex, 1);
  }

  /** 光标左移 */
  moveLeft(): void {
    if (this.cursorIndex > 0) this.cursorIndex--;
  }

  /** 光标右移 */
  moveRight(): void {
    if (this.cursorIndex < this.chars.length) this.cursorIndex++;
  }

  /** 光标移到行首 */
  moveHome(): void {
    this.cursorIndex = 0;
  }

  /** 光标移到行尾 */
  moveEnd(): void {
    this.cursorIndex = this.chars.length;
  }

  /** 清空缓冲区 */
  clear(): void {
    this.chars = [];
    this.cursorIndex = 0;
  }
}
