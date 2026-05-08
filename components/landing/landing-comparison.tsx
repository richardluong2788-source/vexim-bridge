import { Check, X, Minus } from "lucide-react"

/**
 * "Build vs Buy" comparison — the strongest closing argument for any
 * Vietnamese factory CEO weighing whether to hire a US sales team or
 * outsource to Vexim. Numbers are conservative US market averages
 * (Glassdoor / BLS 2024 data, FDA consulting market rates).
 */

type Cell =
  | { kind: "ok"; text: string }
  | { kind: "bad"; text: string }
  | { kind: "neutral"; text: string }

const ROWS: { label: string; selfBuild: Cell; vexim: Cell }[] = [
  {
    label: "Chi phí cố định mỗi năm",
    selfBuild: {
      kind: "bad",
      text: "≈ $150,000 – $220,000 (1 sales Mỹ + 1 trợ lý + tools)",
    },
    vexim: {
      kind: "ok",
      text: "Phí duy trì hàng tháng cố định, thấp hơn 60–75%",
    },
  },
  {
    label: "Chi phí FDA & tuân thủ",
    selfBuild: {
      kind: "bad",
      text: "$5,000 – $15,000 mỗi lần đăng ký, thuê tư vấn riêng",
    },
    vexim: { kind: "ok", text: "Đã bao gồm trong dịch vụ trọn gói" },
  },
  {
    label: "Thời gian có đơn đầu tiên",
    selfBuild: {
      kind: "bad",
      text: "9 – 18 tháng (tuyển + đào tạo + xây pipeline)",
    },
    vexim: { kind: "ok", text: "8 – 12 tuần kể từ ngày ký hợp đồng" },
  },
  {
    label: "Mạng lưới buyer Mỹ có sẵn",
    selfBuild: {
      kind: "bad",
      text: "Bắt đầu từ con số 0, mất 1–2 năm xây quan hệ",
    },
    vexim: {
      kind: "ok",
      text: "Database buyer đã thẩm định, tiếp cận 50+/tháng",
    },
  },
  {
    label: "Kiến thức ngành & rào cản pháp lý Mỹ",
    selfBuild: {
      kind: "neutral",
      text: "Phụ thuộc vào năng lực 1–2 cá nhân tuyển được",
    },
    vexim: {
      kind: "ok",
      text: "Đội ngũ chuyên trách FDA, MoCRA, DSHEA, 510(k)",
    },
  },
  {
    label: "Rủi ro lừa đảo thanh toán & L/C giả",
    selfBuild: {
      kind: "bad",
      text: "Tự chịu — phần lớn nhà máy không có quy trình verify",
    },
    vexim: {
      kind: "ok",
      text: "Verify SWIFT 2 lớp, thẩm định ngân hàng phát hành L/C",
    },
  },
  {
    label: "Khi nhân sự nghỉ việc",
    selfBuild: {
      kind: "bad",
      text: "Mất pipeline, mất quan hệ buyer, tuyển lại từ đầu",
    },
    vexim: {
      kind: "ok",
      text: "Đội nhiều người, dữ liệu lưu trên hệ thống của bạn",
    },
  },
  {
    label: "Khi đơn hàng = 0",
    selfBuild: {
      kind: "bad",
      text: "Vẫn phải trả lương cố định + thuế + bảo hiểm Mỹ",
    },
    vexim: {
      kind: "ok",
      text: "Hoa hồng chỉ tính khi đơn đã thu USD thành công",
    },
  },
]

function CellRender({ cell }: { cell: Cell }) {
  const Icon = cell.kind === "ok" ? Check : cell.kind === "bad" ? X : Minus
  const colour =
    cell.kind === "ok"
      ? "text-accent"
      : cell.kind === "bad"
        ? "text-destructive"
        : "text-muted-foreground"
  const bg =
    cell.kind === "ok"
      ? "bg-accent/15"
      : cell.kind === "bad"
        ? "bg-destructive/10"
        : "bg-muted"
  return (
    <div className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${bg} ${colour}`}
      >
        <Icon className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
      </span>
      <span className="text-sm leading-relaxed text-foreground">
        {cell.text}
      </span>
    </div>
  )
}

export function LandingComparison() {
  return (
    <section
      id="comparison"
      aria-labelledby="comparison-title"
      className="scroll-mt-20 border-b border-border/60 bg-secondary/40"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">
            Tự xây vs Thuê Vexim
          </p>
          <h2
            id="comparison-title"
            className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            Tự xây phòng sale tại Mỹ tốn bao nhiêu?
          </h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
            So sánh thẳng thắn dựa trên mức lương trung bình thị trường Mỹ năm 2024
            và chi phí tư vấn FDA phổ biến. Đây là bài toán thực mà mọi giám đốc
            xuất khẩu phải tự trả lời trước khi quyết định.
          </p>
        </div>

        {/* Desktop table */}
        <div className="mt-12 hidden overflow-hidden rounded-xl border border-border/80 bg-card md:block">
          <div className="grid grid-cols-12 border-b border-border bg-muted/40 px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <div className="col-span-4">Hạng mục</div>
            <div className="col-span-4">Tự xây phòng sale Mỹ</div>
            <div className="col-span-4 text-primary">Thuê Vexim Bridge</div>
          </div>
          {ROWS.map((row, idx) => (
            <div
              key={row.label}
              className={`grid grid-cols-12 items-start gap-6 px-6 py-5 ${
                idx % 2 === 1 ? "bg-muted/20" : ""
              }`}
            >
              <div className="col-span-4 text-sm font-semibold text-foreground">
                {row.label}
              </div>
              <div className="col-span-4">
                <CellRender cell={row.selfBuild} />
              </div>
              <div className="col-span-4">
                <CellRender cell={row.vexim} />
              </div>
            </div>
          ))}
        </div>

        {/* Mobile stacked cards */}
        <div className="mt-12 flex flex-col gap-4 md:hidden">
          {ROWS.map((row) => (
            <article
              key={row.label}
              className="flex flex-col gap-4 rounded-xl border border-border/80 bg-card p-5"
            >
              <h3 className="text-sm font-semibold text-foreground">
                {row.label}
              </h3>
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Tự xây phòng sale Mỹ
                  </p>
                  <div className="mt-1.5">
                    <CellRender cell={row.selfBuild} />
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                    Thuê Vexim Bridge
                  </p>
                  <div className="mt-1.5">
                    <CellRender cell={row.vexim} />
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mx-auto mt-10 max-w-3xl rounded-lg border border-accent/30 bg-accent/5 p-5 text-center">
          <p className="text-sm leading-relaxed text-foreground">
            <span className="font-semibold">Nói cách khác:</span> bạn không tuyển
            người, không trả lương Mỹ, không xây pipeline từ đầu - bạn thuê một đội
            đã có sẵn năng lực, mạng lưới và quy trình kiểm soát rủi ro.
          </p>
        </div>
      </div>
    </section>
  )
}
