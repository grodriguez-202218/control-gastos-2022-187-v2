export interface BlobField {
  size: number;
  left: number;
  top: number;
  animationDelay: number;
  animationDuration: number;
}

export function generateBlobs(count = 6): BlobField[] {
  return Array.from({ length: count }).map(() => ({
    size: Math.random() * 200 + 150,
    left: Math.random() * 80 + 10,
    top: Math.random() * 80 + 10,
    animationDelay: Math.random() * -20,
    animationDuration: Math.random() * 15 + 15,
  }));
}

export function moveBlobs(refs: HTMLElement[], event: MouseEvent): void {
  const x = event.clientX / window.innerWidth;
  const y = event.clientY / window.innerHeight;

  refs.forEach((blob, index) => {
    const speed = (index + 1) * 20;
    blob.style.marginLeft = `${x * speed}px`;
    blob.style.marginTop = `${y * speed}px`;
  });
}