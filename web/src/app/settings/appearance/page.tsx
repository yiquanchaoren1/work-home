"use client"

import {useEffect,useState} from "react"
import {Link} from "react-router-dom"
import {useWorkspace} from "@/hub/workspace"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"
import { BaseLayout } from "@/components/layouts/base-layout"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const appearanceFormSchema = z.object({
  theme: z.enum(["light", "dark"]),
  fontFamily: z.string().optional(),
  fontSize: z.string().optional(),
  sidebarWidth: z.string().optional(),
  contentWidth: z.string().optional(),
})

type AppearanceFormValues = z.infer<typeof appearanceFormSchema>

export default function AppearanceSettings() {
  const w=useWorkspace(),[open,setOpen]=useState(false),[notice,setNotice]=useState("")
  const form = useForm<AppearanceFormValues>({
    resolver: zodResolver(appearanceFormSchema),
    defaultValues: {
      theme: "light",
      fontFamily: "",
      fontSize: "",
      sidebarWidth: "",
      contentWidth: "",
    },
  })

  useEffect(()=>{if(!w.loading){const style=w.data.settings.ui?.styles||{};form.reset({theme:w.data.settings.theme==='dark'?'dark':'light',fontFamily:style['--font-inter']?.includes('Georgia')?'serif':'system',fontSize:style['--hub-font-size']==='17px'?'large':style['--hub-font-size']==='14px'?'small':'medium',sidebarWidth:style['--hub-sidebar-width']==='14rem'?'compact':style['--hub-sidebar-width']==='18rem'?'spacious':'comfortable',contentWidth:style['--hub-content-width']==='1200px'?'fixed':style['--hub-content-width']==='1440px'?'container':'fluid'})}},[w.loading])
  useEffect(()=>{if(!w.loading)form.setValue('theme',w.data.settings.theme==='dark'?'dark':'light')},[w.loading,w.data.settings.theme])
  function onSubmit(data: AppearanceFormValues) {
    const shared={'--font-inter':data.fontFamily==='serif'?'Georgia, "Microsoft YaHei", serif':data.fontFamily==='inter'?'Inter, "Segoe UI", "Microsoft YaHei", sans-serif':'system-ui, "Microsoft YaHei", sans-serif','--hub-font-size':data.fontSize==='small'?'14px':data.fontSize==='large'?'17px':'16px','--hub-sidebar-width':data.sidebarWidth==='compact'?'14rem':data.sidebarWidth==='spacious'?'18rem':'16rem','--hub-content-width':data.contentWidth==='fixed'?'1200px':data.contentWidth==='container'?'1440px':'none'}
    if(w.save({...w.current.current,settings:{...w.current.current.settings,theme:data.theme,ui:{...w.current.current.settings.ui,styles:{...w.current.current.settings.ui?.styles,...shared},darkStyles:{...w.current.current.settings.ui?.darkStyles,...shared}}}},'保存外观设置'))setNotice('外观已应用，正在后台保存。')
  }

  return (
    <BaseLayout customizerOpen={open} onCustomizerOpenChange={setOpen} title="外观设置" description="沿用 ShadcnStore 的外观表单与主题定制器，设置保存到当前资料文件。">
      <div className="flex flex-col gap-6 px-4 lg:px-6">
        <div>
          <nav className="flex flex-wrap gap-2"><Button variant="secondary">外观</Button><Button nativeButton={false} variant="outline" render={<Link to="/settings/connections"/>}>资料连接</Button><Button nativeButton={false} variant="outline" render={<Link to="/settings/data"/>}>同步与备份</Button></nav>
          <p className="text-muted-foreground">
            使用右侧定制器选择完整配色，也可以在这里调整文字与内容宽度。
          </p>
        </div>
        <Button variant="outline" className="w-fit" onClick={()=>setOpen(true)}>打开配色与布局定制器</Button>
        {notice&&<p role="status" className="text-sm text-muted-foreground">{notice}</p>}
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-6 max-w-2xl"
        >
          <FieldGroup>
            {/* Theme Section */}
            <Controller
              control={form.control}
              name="theme"
              render={({ field, fieldState }) => (
                <FieldSet data-invalid={fieldState.invalid}>
                  <FieldLegend>明暗模式</FieldLegend>
                  <RadioGroup
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    className="flex gap-4"
                  >
                    <FieldLabel
                      htmlFor="appearance-theme-light"
                      className="cursor-pointer gap-0 rounded-md [&:has([data-checked])>div]:border-primary"
                    >
                      <RadioGroupItem
                        id="appearance-theme-light"
                        value="light"
                        className="sr-only absolute"
                        aria-invalid={fieldState.invalid}
                      />
                      <div className="rounded-md border-2 border-muted p-4 hover:border-accent transition-colors">
                        <div className="flex flex-col gap-2">
                          <div className="size-20 bg-white border rounded-md p-3">
                            <div className="flex flex-col gap-2">
                              <div className="h-2 bg-gray-200 rounded w-3/4"></div>
                              <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                              <div className="flex gap-2">
                                <div className="size-2 bg-gray-300 rounded-full"></div>
                                <div className="h-2 bg-gray-200 rounded flex-1"></div>
                              </div>
                              <div className="flex gap-2">
                                <div className="size-2 bg-gray-300 rounded-full"></div>
                                <div className="h-2 bg-gray-200 rounded flex-1"></div>
                              </div>
                            </div>
                          </div>
                          <span className="text-sm font-medium">浅色</span>
                        </div>
                      </div>
                    </FieldLabel>
                    <FieldLabel
                      htmlFor="appearance-theme-dark"
                      className="cursor-pointer gap-0 rounded-md [&:has([data-checked])>div]:border-primary"
                    >
                      <RadioGroupItem
                        id="appearance-theme-dark"
                        value="dark"
                        className="sr-only absolute"
                        aria-invalid={fieldState.invalid}
                      />
                      <div className="rounded-md border-2 border-muted p-4 hover:border-accent transition-colors">
                        <div className="flex flex-col gap-2">
                          <div className="size-20 bg-gray-900 border border-gray-700 rounded-md p-3">
                            <div className="flex flex-col gap-2">
                              <div className="h-2 bg-gray-600 rounded w-3/4"></div>
                              <div className="h-2 bg-gray-600 rounded w-1/2"></div>
                              <div className="flex gap-2">
                                <div className="size-2 bg-gray-500 rounded-full"></div>
                                <div className="h-2 bg-gray-600 rounded flex-1"></div>
                              </div>
                              <div className="flex gap-2">
                                <div className="size-2 bg-gray-500 rounded-full"></div>
                                <div className="h-2 bg-gray-600 rounded flex-1"></div>
                              </div>
                            </div>
                          </div>
                          <span className="text-sm font-medium">深色</span>
                        </div>
                      </div>
                    </FieldLabel>
                  </RadioGroup>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </FieldSet>
              )}
            />

            <Controller
              control={form.control}
              name="fontFamily"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="appearance-font-family">
                    字体
                  </FieldLabel>
                  <Select
                    items={{
                      inter: "Inter",
                      serif: "衬线字体",
                      system: "系统字体",
                    }}
                    name={field.name}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <SelectTrigger
                      id="appearance-font-family"
                      aria-invalid={fieldState.invalid}
                      className="cursor-pointer"
                    >
                      <SelectValue placeholder="Select a font" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="inter">Inter</SelectItem>
                        <SelectItem value="serif">衬线字体</SelectItem>
                        <SelectItem value="system">系统字体</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="fontSize"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="appearance-font-size">
                    字号
                  </FieldLabel>
                  <Select
                    items={{ small: "较小", medium: "标准", large: "较大" }}
                    name={field.name}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <SelectTrigger
                      id="appearance-font-size"
                      aria-invalid={fieldState.invalid}
                      className="cursor-pointer"
                    >
                      <SelectValue placeholder="Select font size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="small">较小</SelectItem>
                        <SelectItem value="medium">标准</SelectItem>
                        <SelectItem value="large">较大</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            {/* Layout Section */}
            <Controller
              control={form.control}
              name="sidebarWidth"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="appearance-sidebar-width">
                    侧栏宽度
                  </FieldLabel>
                  <Select
                    items={{
                      compact: "紧凑",
                      comfortable: "标准",
                      spacious: "宽松",
                    }}
                    name={field.name}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <SelectTrigger
                      id="appearance-sidebar-width"
                      aria-invalid={fieldState.invalid}
                      className="cursor-pointer"
                    >
                      <SelectValue placeholder="Select sidebar width" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="compact">紧凑</SelectItem>
                        <SelectItem value="comfortable">标准</SelectItem>
                        <SelectItem value="spacious">宽松</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="contentWidth"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="appearance-content-width">
                    内容宽度
                  </FieldLabel>
                  <Select
                    items={{
                      fixed: "固定 1200px",
                      fluid: "自适应",
                      container: "最大 1440px",
                    }}
                    name={field.name}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <SelectTrigger
                      id="appearance-content-width"
                      aria-invalid={fieldState.invalid}
                      className="cursor-pointer"
                    >
                      <SelectValue placeholder="Select content width" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="fixed">固定 1200px</SelectItem>
                        <SelectItem value="fluid">自适应</SelectItem>
                        <SelectItem value="container">最大 1440px</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </FieldGroup>

          <div className="flex gap-2 mt-12">
            <Button type="submit" className="cursor-pointer">
              保存外观设置
            </Button>
            <Button variant="outline" type="button" className="cursor-pointer" onClick={()=>{form.reset();setNotice("已还原本页表单，尚未保存的调整已取消。")}}>
              还原表单
            </Button>
          </div>
        </form>
      </div>
    </BaseLayout>
  )
}
