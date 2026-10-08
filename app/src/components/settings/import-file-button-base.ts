export interface ImportFileButtonProps {
  /** The button's words, such as "Choose CSV File". */
  label: string;
  /** The file types taken, as an `<input accept>` list: `.csv`, or `.vcf,text/vcard`. */
  accept: string;
  /** Called with the picked file's text. Not called when the user backs out, or picks another kind of file. */
  onPick: (text: string) => void;
}
